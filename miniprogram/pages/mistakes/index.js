const app = getApp();

Page({
  data: {
    mistakeWords: [] // 错误单词列表
  },

  onLoad: function (options) {
    // 加载错题本
    this.loadMistakeWords();
  },
  
  onShow: function () {
    this.loadMistakes();
  },

  // 加载错题本
  loadMistakeWords: function () {
    // 如果用户已登录，则从云数据库加载
    if (app.globalData.userInfo) {
      const db = wx.cloud.database();
      db.collection('mistakeWords').where({
        _openid: app.globalData.userInfo.openId
      }).get().then(res => {
        if (res.data.length > 0) {
          this.setData({
            mistakeWords: res.data[0].words || []
          });
        } else {
          // 使用模拟数据
          this.setMockData();
        }
      }).catch(err => {
        console.error('获取错题本失败：', err);
        // 使用模拟数据
        this.setMockData();
      });
    } else {
      // 未登录用户使用模拟数据
      this.setMockData();
    }
  },

  // 设置模拟数据
  setMockData: function() {
    const mockMistakes = [
      { word: 'bird', phonetic: '/bɜːrd/', userAnswer: 'brid', addTime: new Date() },
      { word: 'orange', phonetic: '/ˈɔːrɪndʒ/', userAnswer: 'orage', addTime: new Date() },
      { word: 'difficult', phonetic: '/ˈdɪfɪkəlt/', userAnswer: 'diffcult', addTime: new Date() },
      { word: 'beautiful', phonetic: '/ˈbjuːtɪfl/', userAnswer: 'beautful', addTime: new Date() },
      { word: 'necessary', phonetic: '/ˈnesəseri/', userAnswer: 'neccesary', addTime: new Date() }
    ];
    
    this.setData({
      mistakeWords: mockMistakes
    });
  },

  // 播放单词发音
  playWord: function (e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    
    // 调用云函数获取单词发音
    wx.cloud.callFunction({
      name: 'getWordAudio',
      data: {
        word: word,
        type: app.globalData.pronunciationSettings.type,
        speed: 1.0
      }
    }).then(res => {
      if (res.result && res.result.audioUrl) {
        // 播放音频
        const innerAudioContext = wx.createInnerAudioContext();
        innerAudioContext.src = res.result.audioUrl;
        innerAudioContext.play();
      } else {
        // 使用本地TTS
        this.useLocalTTS(word);
      }
    }).catch(err => {
      console.error('获取单词发音失败：', err);
      this.useLocalTTS(word);
    });
  },

  // 使用本地TTS播放单词
  useLocalTTS: function (word) {
    const textToSpeech = requirePlugin('tts');
    textToSpeech.textToSpeech({
      lang: 'en_US',
      content: word,
      success: function (res) {
        console.log('TTS调用成功', res);
      },
      fail: function (res) {
        console.error('TTS调用失败', res);
        wx.showToast({
          title: '播放失败',
          icon: 'none'
        });
      }
    });
  },

  // 移除单个错词
  removeWord: function (e) {
    const word = e.currentTarget.dataset.word;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要从错题本中删除 "${word}" 吗？`,
      success: res => {
        if (res.confirm) {
          // 更新本地数据
          const updatedMistakes = this.data.mistakeWords.filter(item => item.word !== word);
          this.setData({
            mistakeWords: updatedMistakes
          });
          
          // 如果用户已登录，更新云数据库
          if (app.globalData.userInfo) {
            const db = wx.cloud.database();
            db.collection('mistakeWords').where({
              _openid: app.globalData.userInfo.openId
            }).get().then(res => {
              if (res.data.length > 0) {
                db.collection('mistakeWords').doc(res.data[0]._id).update({
                  data: {
                    words: updatedMistakes,
                    updateTime: new Date()
                  }
                });
              }
            });
          }
          
          wx.showToast({
            title: '删除成功'
          });
        }
      }
    });
  },

  // 清空错题本
  clearAllMistakes: function () {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空整个错题本吗？此操作不可恢复。',
      success: res => {
        if (res.confirm) {
          // 清空本地数据
          this.setData({
            mistakeWords: []
          });
          
          // 如果用户已登录，更新云数据库
          if (app.globalData.userInfo) {
            const db = wx.cloud.database();
            db.collection('mistakeWords').where({
              _openid: app.globalData.userInfo.openId
            }).get().then(res => {
              if (res.data.length > 0) {
                db.collection('mistakeWords').doc(res.data[0]._id).update({
                  data: {
                    words: [],
                    updateTime: new Date()
                  }
                });
              }
            });
          }
          
          wx.showToast({
            title: '已清空错题本'
          });
        }
      }
    });
  },

  // 开始错题听写
  startDictation: function () {
    const { mistakeWords } = this.data;
    
    if (mistakeWords.length === 0) {
      wx.showToast({
        title: '没有可听写的单词',
        icon: 'none'
      });
      return;
    }
    
    // 提取错词列表
    const words = mistakeWords.map(item => item.word);
    
    // 存入全局变量，以便听写页面使用
    app.globalData.currentDictationWords = words;
    app.globalData.currentDictationTitle = '错题本单词';
    
    // 跳转到听写页面
    wx.navigateTo({
      url: '/pages/dictation/index'
    });
  },

  // 跳转到首页
  goToHome: function () {
    wx.switchTab({
      url: '/pages/home/index'
    });
  }
}) 