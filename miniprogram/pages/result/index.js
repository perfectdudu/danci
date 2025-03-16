const app = getApp();

Page({
  data: {
    result: null, // 听写结果
    recordId: '' // 记录ID
  },

  // 处理导航栏返回按钮点击
  onBackClick() {
    wx.switchTab({
      url: '/pages/record/index'
    });
  },

  onLoad: function (options) {
    // 如果有传入记录ID，则从云数据库加载
    if (options.id) {
      this.setData({
        recordId: options.id
      });
      this.loadRecordById(options.id);
    } else {
      // 否则使用全局变量中的当前听写结果
      const result = app.globalData.currentDictationResult;
      
      if (!result) {
        // 使用模拟数据
        const mockResult = {
          id: 'mock-result-' + Date.now(),
          title: '英语基础词汇',
          date: new Date(),
          correctCount: 7,
          wrongCount: 2,
          totalCount: 9,
          accuracy: 78,
          timeSpent: '3',
          words: [
            { word: 'book', translation: '书, 书本', correct: true, userAnswer: 'book', phonetic: '/bʊk/' },
            { word: 'ruler', translation: '尺子', correct: true, userAnswer: 'ruler', phonetic: '/ˈruːlər/' },
            { word: 'pencil', translation: '铅笔', correct: true, userAnswer: 'pencil', phonetic: '/ˈpensəl/' },
            { word: 'dog', translation: '狗', correct: true, userAnswer: 'dog', phonetic: '/dɔːɡ/' },
            { word: 'bird', translation: '鸟', correct: false, userAnswer: 'brid', phonetic: '/bɜːrd/' },
            { word: 'eight', translation: '八', correct: true, userAnswer: 'eight', phonetic: '/eɪt/' },
            { word: 'nine', translation: '九', correct: true, userAnswer: 'nine', phonetic: '/naɪn/' },
            { word: 'banana', translation: '香蕉', correct: true, userAnswer: 'banana', phonetic: '/bəˈnɑːnə/' },
            { word: 'orange', translation: '橙子, 橘', correct: false, userAnswer: 'orage', phonetic: '/ˈɔːrɪndʒ/' }
          ]
        };
        
        this.setData({
          result: mockResult
        });
        
        return;
      }
      
      this.setData({
        result: result
      });
      
      // 获取单词音标
      this.getWordsPhonetic(result.words);
    }
  },

  // 根据ID从云数据库加载记录
  loadRecordById: function (id) {
    const db = wx.cloud.database();
    
    db.collection('dictationRecords').where({
      id: id
    }).get().then(res => {
      if (res.data.length > 0) {
        this.setData({
          result: res.data[0]
        });
      } else {
        wx.showToast({
          title: '未找到听写记录',
          icon: 'none'
        });
        
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    }).catch(err => {
      console.error('获取听写记录失败：', err);
      wx.showToast({
        title: '加载记录失败',
        icon: 'none'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    });
  },

  // 获取单词音标
  getWordsPhonetic: function (words) {
    if (!words || words.length === 0) return;
    
    // 只处理没有音标的单词
    const wordsWithoutPhonetic = words.filter(word => !word.phonetic);
    if (wordsWithoutPhonetic.length === 0) return;
    
    // 批量获取单词音标
    const wordsList = wordsWithoutPhonetic.map(item => item.word);
    
    wx.cloud.callFunction({
      name: 'getWordsPhonetic',
      data: {
        words: wordsList
      }
    }).then(res => {
      if (res.result && res.result.phonetics) {
        const phonetics = res.result.phonetics;
        
        // 更新单词音标
        const updatedWords = words.map(item => {
          if (!item.phonetic && phonetics[item.word]) {
            item.phonetic = phonetics[item.word];
          }
          return item;
        });
        
        // 更新结果
        const result = this.data.result;
        result.words = updatedWords;
        
        this.setData({
          result: result
        });
        
        // 如果是当前听写结果，则更新全局变量
        if (!this.data.recordId) {
          app.globalData.currentDictationResult = result;
        }
        
        // 如果有recordId，则更新云数据库中的记录
        if (this.data.recordId && app.globalData.userInfo) {
          const db = wx.cloud.database();
          db.collection('dictationRecords').where({
            id: this.data.recordId,
            _openid: app.globalData.userInfo.openId
          }).update({
            data: {
              words: updatedWords
            }
          });
        }
      }
    }).catch(err => {
      console.error('获取单词音标失败：', err);
    });
  },

  // 保存结果（可以导出为图片或分享给好友）
  saveResult: function () {
    wx.showActionSheet({
      itemList: ['分享给好友', '保存为图片'],
      success: res => {
        if (res.tapIndex === 0) {
          // 分享给好友
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
          });
        } else if (res.tapIndex === 1) {
          // 保存为图片
          wx.showToast({
            title: '正在生成图片...',
            icon: 'loading',
            duration: 2000
          });
          
          // 这里应该实现生成图片的逻辑，但由于小程序环境限制，
          // 实际生成图片需要使用canvas绘制，这里只是示例
          setTimeout(() => {
            wx.showToast({
              title: '图片生成功能暂未实现',
              icon: 'none'
            });
          }, 2000);
        }
      }
    });
  },

  // 重新听写
  retryDictation: function () {
    const { result } = this.data;
    
    if (!result) return;
    
    // 提取原始单词列表
    const words = result.words.map(item => item.word);
    
    // 存入全局变量，以便听写页面使用
    app.globalData.currentDictationWords = words;
    app.globalData.currentDictationTitle = result.title;
    
    // 跳转到听写页面
    wx.redirectTo({
      url: '/pages/dictation/index'
    });
  },

  // 用户点击右上角分享
  onShareAppMessage: function () {
    const { result } = this.data;
    
    return {
      title: `我在"${result.title}"听写中获得了${result.accuracy}%的正确率！`,
      path: `/pages/result/index?id=${result.id}`,
      imageUrl: '/images/share-img.png'
    };
  }
}) 