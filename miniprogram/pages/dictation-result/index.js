// 听写结果页面逻辑
const app = getApp();

Page({
  data: {
    dictationTitle: '英语四级词汇',
    correctCount: 42,
    wrongCount: 8,
    correctRate: 84,
    timeUsed: 10,
    wordList: [
    ]
  },

  onLoad: function(options) {
    // 获取serial参数
    if (options.serial) {
      console.log('收到serial参数:', options.serial);
      // 根据serial获取听写记录详情
      this.getRecordDetail(options.serial);
    } else if (app.globalData.dictationResult) {
      // 兼容旧逻辑：从全局数据获取听写结果
      const result = app.globalData.dictationResult;
      this.setData({
        dictationTitle: result.title || this.data.dictationTitle,
        correctCount: result.correctCount || this.data.correctCount,
        wrongCount: result.wrongCount || this.data.wrongCount,
        correctRate: result.correctRate || this.data.correctRate,
        timeUsed: result.timeUsed || this.data.timeUsed,
        wordList: result.wordList || this.data.wordList
      });
    } else {
      // 没有参数也没有全局数据
      wx.showToast({
        title: '未找到听写记录',
        icon: 'none'
      });
    }
  },

  // 返回上一页
  onBack: function() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 预览图片
  previewImage: function() {
    if (this.data.picUrl) {
      wx.previewImage({
        urls: [this.data.picUrl],
        current: this.data.picUrl
      });
    }
  },

  // 再次听写
  retryDictation: function() {
    // 可以保存当前听写词库，重新开始听写
    wx.navigateTo({
      url: '/pages/dictation/index?retry=true'
    });
  },

  // 查看错误
  reviewMistakes: function() {
    // 筛选出错误的单词，进入错误复习页面
    const wrongWords = this.data.wordList.filter(item => !item.isCorrect);
    app.globalData.reviewWords = wrongWords;
    
    wx.navigateTo({
      url: '/pages/review/index'
    });
  },

  // 分享结果
  onShareAppMessage: function() {
    return {
      title: `我在${this.data.dictationTitle}听写中获得了${this.data.correctRate}%的正确率！`,
      path: '/pages/index/index'
    };
  },
  getRecordDetail: async function(serial) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    try {
      const result = await wx.cloud.callContainer({
        "config": {
          "env": "prod-5g5ywun6829a4db5"
        },
        "path": "/record/get",
        "header": {
          "X-WX-SERVICE": "word-dictation",
          "content-type": "application/json",
          "Authorization": `Bearer ${app.globalData.token}`
        },
        "method": "POST",
        "data": {
          "serial": serial
        }
      });
      
      wx.hideLoading();
      
      // 检查API返回结果
      if (result && result.data && result.data.code === 200 && result.data.data) {
        const recordData = result.data.data;
        console.log('获取到听写记录:', recordData);
        
        // 解析原始单词和错误单词
        const originalWords = recordData.words ? recordData.words.split(',') : [];
        const errorWordsStr = recordData.error_words || '';
        
        // 处理错误单词映射
        const errorMap = {};
        if (errorWordsStr) {
          const errorPairs = errorWordsStr.split(',');
          errorPairs.forEach(pair => {
            const [original, actual] = pair.split('-');
            if (original) {
              errorMap[original] = actual || '';
            }
          });
        }
        
        // 构建单词列表，标记正确和错误
        const wordList = originalWords.map(word => {
          const isError = errorMap.hasOwnProperty(word);
          return {
            word: word,
            userInput: isError ? errorMap[word] : word,
            isCorrect: !isError
          };
        });
        
        // 计算统计数据
        const totalCount = wordList.length;
        const wrongCount = Object.keys(errorMap).length;
        const correctCount = totalCount - wrongCount;
        const correctRate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
        
        // 更新界面
        this.setData({
          dictationTitle: recordData.name || '听写记录',
          correctCount,
          wrongCount,
          correctRate,
          wordList,
          recordDate: this.formatDate(new Date(recordData.created_at || Date.now())),
          picUrl: recordData.pic_url || ''
        });
      } else {
        console.error('获取听写记录失败，接口返回:', result);
        wx.showToast({
          title: '获取记录失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取记录详情失败:', error);
      wx.showToast({
        title: '获取记录失败: ' + error.message,
        icon: 'none'
      });
    }
  },
  
  // 格式化日期
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}); 