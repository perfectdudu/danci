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
    ],
    fromComplete: false,  // 添加标记来源的字段
    filterType: 'all', // 默认显示全部单词
    filteredWordList: [] // 过滤后的单词列表
  },

  onLoad: function(options) {
    // 获取serial参数
    if (options.serial) {
      console.log('收到serial参数:', options.serial);
      // 标记是否来自complete页面
      this.setData({
        fromComplete: options.fromPage === 'complete' || false
      });
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
    if (this.data.fromComplete) {
      // 如果来自听写完成页面，则返回到首页
      wx.switchTab({
        url: '/pages/home/index'
      });
    } else {
      // 否则正常返回上一页
      wx.navigateBack({
        delta: 1
      });
    }
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

  // 分享给朋友
  onShareAppMessage: function() {
    return app.shareAppMessage();
  },
  
  // 分享到朋友圈
  onShareTimeline: function() {
    return app.shareTimeline();
  },

  // 解析GMT格式时间
  parseGMTTime: function(gmtString) {
    if (!gmtString) return null;
    
    try {
      // 对于形如 "Fri, 04 Apr 2025 22:08:31 GMT" 的时间字符串
      const gmtDate = new Date(gmtString);
      if (isNaN(gmtDate.getTime())) {
        console.warn('无法解析GMT时间:', gmtString);
        return null;
      }
      return gmtDate;
    } catch (e) {
      console.error('解析GMT时间出错:', e);
      return null;
    }
  },

  // 格式化日期
  formatDate: function(date) {
    if (!date) return '';
    
    // 如果是GMT字符串，直接处理
    if (typeof date === 'string') {
      return this.formatDateFromGMT(date);
    }
    
    // 否则按照原来的逻辑处理Date对象
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // 从GMT字符串格式化日期
  formatDateFromGMT: function (gmtString) {
    if (!gmtString) return '';
    
    const date = this.parseGMTTime(gmtString);
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  },
  
  // 从GMT字符串直接提取时间部分
  extractTimeFromGMT: function(gmtString) {
    if (!gmtString) return '';
    
    // 尝试匹配形如 "Fri, 04 Apr 2025 22:08:31 GMT" 中的时间部分
    const timeRegex = /(\d{2}):(\d{2}):\d{2}/;
    const match = gmtString.match(timeRegex);
    
    if (match && match.length >= 3) {
      // 提取小时和分钟
      const hours = match[1];
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
    
    // 如果无法匹配，回退到使用Date对象
    try {
      const date = new Date(gmtString);
      if (!isNaN(date.getTime())) {
        return String(date.getUTCHours()).padStart(2, '0') + ':' + 
               String(date.getUTCMinutes()).padStart(2, '0');
      }
    } catch (e) {
      console.error('提取时间失败:', e);
    }
    
    return '';
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
        
        // 检查时间字段名称并获取时间字符串
        // 查看返回数据中的所有可能的时间字段
        let timeField = null;
        let gmtString = '';
        
        console.log('检查时间字段:', recordData);
        
        // 检查常见的时间字段名
        const possibleTimeFields = ['created_at', 'create_time', 'createTime', 'createdAt', 'time', 'date'];
        for (const field of possibleTimeFields) {
          if (recordData[field]) {
            timeField = field;
            gmtString = recordData[field];
            console.log(`找到时间字段: ${field}, 值: ${gmtString}`);
            break;
          }
        }
        
        // 如果没有找到时间字段，使用当前时间
        if (!timeField) {
          console.warn('未找到任何时间字段，使用当前时间');
          gmtString = new Date().toISOString();
        }
        
        // 尝试直接从GMT字符串中提取时间（如果格式正确）
        let timeStr = '';
        const timeRegex = /(\d{2}):(\d{2}):\d{2}/;
        const match = gmtString.match(timeRegex);
        
        if (match && match.length >= 3) {
          timeStr = `${match[1]}:${match[2]}`;
          console.log(`从字符串中提取的时间: ${timeStr}`);
        } else {
          // 如果无法直接提取，则使用Date对象
          try {
            const date = new Date(gmtString);
            if (!isNaN(date.getTime())) {
              // 优先使用UTC时间以保持一致性
              timeStr = String(date.getUTCHours()).padStart(2, '0') + ':' + 
                      String(date.getUTCMinutes()).padStart(2, '0');
              console.log(`使用UTC时间: ${timeStr}`);
            } else {
              console.warn('无法解析时间字符串为Date对象');
              timeStr = '00:00'; // 默认时间
            }
          } catch (e) {
            console.error('提取时间时出错:', e);
            timeStr = '00:00'; // 默认时间
          }
        }
        
        // 生成格式化的日期
        let dateStr = '';
        try {
          const date = new Date(gmtString);
          if (!isNaN(date.getTime())) {
            dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            console.log(`格式化的日期: ${dateStr}`);
          } else {
            console.warn('无法将字符串解析为Date对象用于日期');
            dateStr = '????-??-??'; // 默认日期
          }
        } catch (e) {
          console.error('格式化日期时出错:', e);
          dateStr = '????-??-??'; // 默认日期
        }
        
        // 完整的日期时间字符串
        const recordDate = dateStr + ' ' + timeStr;
        console.log(`最终的日期时间字符串: ${recordDate}`);
        
        // 更新界面
        this.setData({
          dictationTitle: recordData.name || '听写记录',
          correctCount,
          wrongCount,
          correctRate,
          wordList,
          recordDate,
          picUrl: recordData.pic_url || '',
          filterType: 'all',
          filteredWordList: wordList // 初始显示全部单词
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

  // 切换过滤类型
  toggleFilter: function(e) {
    const filterType = e.currentTarget.dataset.filter;
    
    // 如果点击的是当前已选中的过滤类型，不进行操作
    if (filterType === this.data.filterType) {
      return;
    }
    
    // 根据过滤类型筛选单词列表
    let filteredWordList = [];
    if (filterType === 'all') {
      filteredWordList = this.data.wordList;
    } else if (filterType === 'wrong') {
      filteredWordList = this.data.wordList.filter(item => !item.isCorrect);
    }
    
    // 更新数据
    this.setData({
      filterType: filterType,
      filteredWordList: filteredWordList
    });
    
    // 显示切换提示
    // wx.showToast({
    //   title: filterType === 'all' ? '显示全部单词' : '仅显示错误单词',
    //   icon: 'none',
    //   duration: 1000
    // });
  }
}); 