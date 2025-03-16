const app = getApp();

Page({
  data: {
    currentIndex: 0, // 当前单词索引
    totalWords: 0, // 单词总数
    wordList: [], // 单词列表
    currentWord: '', // 当前单词
    currentInput: '', // 当前输入的单词
    dictationResults: [], // 听写结果
    startTime: null, // 开始时间
    endTime: null, // 结束时间
    title: '', // 单词列表标题
    isPlaying: false, // 添加播放状态
    initialPlay: true // 初始加载状态
  },

  onLoad: function (options) {
    // 从全局变量获取单词列表
    const wordList = app.globalData.currentDictationWords || [];
    const title = app.globalData.currentDictationTitle || '临时单词列表';
    
    if (wordList.length === 0) {
      // 使用模拟数据
      const mockWords = [
        'book',
        'ruler',
        'pencil',
        'dog',
        'bird',
        'eight',
        'nine',
        'banana',
        'orange'
      ];
      
      // 随机排序单词
      const shuffledWords = this.shuffleArray([...mockWords]);
      
      this.setData({
        wordList: shuffledWords,
        totalWords: shuffledWords.length,
        currentWord: shuffledWords[0],
        title: '英语基础词汇',
        startTime: new Date(), // 记录开始时间
        isPlaying: true // 默认设置为播放状态，显示暂停按钮
      });
      
      // 自动播放第一个单词
      setTimeout(() => {
        this.playWord();
      }, 500);
      
      return;
    }
    
    // 随机排序单词
    const shuffledWords = this.shuffleArray([...wordList]);
    
    this.setData({
      wordList: shuffledWords,
      totalWords: shuffledWords.length,
      currentWord: shuffledWords[0],
      title: title,
      startTime: new Date(), // 记录开始时间
      isPlaying: true // 默认设置为播放状态，显示暂停按钮
    });
    
    // 自动播放第一个单词
    setTimeout(() => {
      this.playWord();
    }, 500);
  },

  // 播放当前单词
  playWord: function () {
    const { currentWord, isPlaying } = this.data;
    
    // 如果是初始加载，不需要切换状态
    if (this.initialPlay) {
      this.initialPlay = false;
    } else if (isPlaying) {
      // 如果正在播放，则暂停
      this.innerAudioContext && this.innerAudioContext.stop();
      this.setData({ isPlaying: false });
      return;
    }
    
    // 设置播放状态
    this.setData({ isPlaying: true });
    
    // 创建音频上下文
    if (!this.innerAudioContext) {
      this.innerAudioContext = wx.createInnerAudioContext();
      this.innerAudioContext.onEnded(() => {
        // 播放结束后不改变按钮状态，保持暂停图标
        // this.setData({ isPlaying: false });
      });
      this.innerAudioContext.onError(() => {
        wx.showToast({
          title: '播放失败',
          icon: 'none'
        });
        // 播放失败也保持暂停图标
        // this.setData({ isPlaying: false });
      });
    }
    
    // 获取发音设置
    const playSettings = app.globalData.playSettings || {};
    const accent = playSettings.accent || 'us'; // 默认美式发音
    
    // 构建语音URL
    const word = currentWord.word || '';
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${accent === 'us' ? 0 : 1}`;
    
    this.innerAudioContext.src = url;
    this.innerAudioContext.play();
    
    // 移除震动反馈
  },

  // 上一个单词
  prevWord: function() {
    const { currentIndex } = this.data;
    
    // 如果是第一个单词，提示用户
    if (currentIndex <= 0) {
      wx.showToast({
        title: '已经是第一个单词',
        icon: 'none'
      });
      return;
    }
    
    // 停止当前播放
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
    
    // 切换到上一个单词
    const prevIndex = currentIndex - 1;
    this.setData({
      currentIndex: prevIndex,
      currentWord: this.data.wordList[prevIndex],
      isPlaying: true
    });
    
    // 立即播放上一个单词，不需要延迟
    this.playWord();
  },

  // 下一个单词
  nextWord: function () {
    const { currentIndex, totalWords } = this.data;
    
    // 如果已经是最后一个单词，提示用户
    if (currentIndex >= totalWords - 1) {
      wx.showToast({
        title: '已经是最后一个单词',
        icon: 'none'
      });
      return;
    }
    
    // 停止当前播放
    if (this.innerAudioContext) {
      this.innerAudioContext.stop();
    }
    
    // 继续下一个单词
    const nextIndex = currentIndex + 1;
    this.setData({
      currentIndex: nextIndex,
      currentWord: this.data.wordList[nextIndex],
      isPlaying: true
    });
    
    // 立即播放下一个单词，不需要延迟
    this.playWord();
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

  // 慢速播放当前单词
  playSlowly: function () {
    const word = this.data.currentWord;
    if (!word) return;
    
    // 调用云函数获取慢速发音
    wx.cloud.callFunction({
      name: 'getWordAudio',
      data: {
        word: word,
        type: app.globalData.pronunciationSettings.type,
        speed: 0.6 // 慢速
      }
    }).then(res => {
      if (res.result && res.result.audioUrl) {
        // 播放音频
        const innerAudioContext = wx.createInnerAudioContext();
        innerAudioContext.src = res.result.audioUrl;
        innerAudioContext.play();
      } else {
        // 使用本地TTS，但无法控制速度
        this.useLocalTTS(word);
      }
    }).catch(err => {
      console.error('获取单词慢速发音失败：', err);
      this.useLocalTTS(word);
    });
  },

  // 处理输入变化
  onInputChange: function (e) {
    this.setData({
      currentInput: e.detail.value
    });
  },

  // 跳过当前单词
  skipWord: function () {
    const { currentIndex, totalWords, currentWord, dictationResults } = this.data;
    
    // 记录跳过的单词
    dictationResults.push({
      word: currentWord,
      userAnswer: '',
      correct: false,
      skipped: true,
      phonetic: ''
    });
    
    this.setData({
      dictationResults
    });
    
    // 如果已经是最后一个单词，结束听写
    if (currentIndex >= totalWords - 1) {
      this.finishDictation();
      return;
    }
    
    // 继续下一个单词
    const nextIndex = currentIndex + 1;
    this.setData({
      currentIndex: nextIndex,
      currentWord: this.data.wordList[nextIndex],
      currentInput: ''
    });
    
    // 自动播放下一个单词
    if (app.globalData.playSettings.autoPlay) {
      setTimeout(() => {
        this.playWord();
      }, app.globalData.playSettings.interval * 1000);
    }
  },

  // 结束听写
  endDictation: function () {
    wx.showModal({
      title: '结束听写',
      content: '确定要结束当前听写吗？',
      success: res => {
        if (res.confirm) {
          // 跳转到听写完成页面
          wx.navigateTo({
            url: '/pages/dictation-complete/index'
          });
        }
      }
    });
  },

  // 完成听写，计算结果
  finishDictation: function () {
    const { dictationResults, currentWord, currentInput, title } = this.data;
    
    // 处理当前词
    if (currentWord && dictationResults.length < this.data.totalWords) {
      const isCorrect = currentInput.trim().toLowerCase() === currentWord.toLowerCase();
      
      dictationResults.push({
        word: currentWord,
        userAnswer: currentInput.trim(),
        correct: isCorrect,
        phonetic: ''
      });
    }
    
    // 记录结束时间
    this.setData({
      endTime: new Date(),
      dictationResults
    });
    
    // 计算统计数据
    const correctCount = dictationResults.filter(item => item.correct).length;
    const totalCount = dictationResults.length;
    const wrongCount = totalCount - correctCount;
    const accuracy = Math.round((correctCount / totalCount) * 100);
    
    // 计算用时（分钟）
    const timeSpent = Math.round((this.data.endTime - this.data.startTime) / 1000 / 60);
    
    // 创建听写记录
    const dictationRecord = {
      id: Date.now().toString(),
      title: title,
      correctCount,
      wrongCount,
      totalCount,
      accuracy,
      timeSpent,
      createTime: new Date(),
      words: dictationResults
    };
    
    // 保存全局结果，以便结果页面使用
    app.globalData.currentDictationResult = dictationRecord;
    
    // 如果用户已登录，则保存到云数据库
    if (app.globalData.userInfo) {
      const db = wx.cloud.database();
      db.collection('dictationRecords').add({
        data: dictationRecord
      }).then(res => {
        console.log('听写记录保存成功', res);
      }).catch(err => {
        console.error('保存听写记录失败：', err);
      });
    }
    
    // 如果开启了自动收集错题功能，则将错词添加到错题本
    if (app.globalData.otherSettings.collectMistakes) {
      const wrongWords = dictationResults.filter(item => !item.correct);
      
      if (wrongWords.length > 0 && app.globalData.userInfo) {
        const db = wx.cloud.database();
        db.collection('mistakeWords').where({
          _openid: app.globalData.userInfo.openId
        }).get().then(res => {
          let mistakeWords = res.data.length > 0 ? res.data[0].words || [] : [];
          
          // 添加新的错词
          wrongWords.forEach(wrong => {
            const exists = mistakeWords.some(item => item.word === wrong.word);
            if (!exists) {
              mistakeWords.push({
                word: wrong.word,
                userAnswer: wrong.userAnswer,
                phonetic: wrong.phonetic,
                addTime: new Date()
              });
            }
          });
          
          // 更新或创建错题本
          if (res.data.length > 0) {
            db.collection('mistakeWords').doc(res.data[0]._id).update({
              data: {
                words: mistakeWords,
                updateTime: new Date()
              }
            });
          } else {
            db.collection('mistakeWords').add({
              data: {
                words: mistakeWords,
                createTime: new Date()
              }
            });
          }
        });
      }
    }
    
    // 跳转到结果页面
    wx.redirectTo({
      url: '/pages/result/index'
    });
  },

  // 确认退出听写
  confirmExit: function () {
    wx.showModal({
      title: '确认返回',
      content: '确定要返回上一页吗？当前的听写进度将丢失，无法恢复。',
      confirmText: '确认返回',
      cancelText: '继续听写',
      confirmColor: '#4CAF50',
      success: res => {
        if (res.confirm) {
          // 停止当前播放
          if (this.innerAudioContext) {
            this.innerAudioContext.stop();
          }
          wx.navigateBack();
        }
      }
    });
  },

  // 随机排序数组
  shuffleArray: function (array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}) 