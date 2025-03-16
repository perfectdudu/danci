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
      {
        word: 'apple',
        phonetic: '/ˈæpl/',
        isCorrect: true,
        userAnswer: 'apple'
      },
      {
        word: 'banana',
        phonetic: '/bəˈnɑːnə/',
        isCorrect: true,
        userAnswer: 'banana'
      },
      {
        word: 'orange',
        phonetic: '/ˈɔrɪndʒ/',
        isCorrect: false,
        userAnswer: 'orang'
      },
      {
        word: 'apple',
        phonetic: '/ˈæpl/',
        isCorrect: true,
        userAnswer: 'apple'
      },
      {
        word: 'banana',
        phonetic: '/bəˈnɑːnə/',
        isCorrect: true,
        userAnswer: 'banana'
      },
      {
        word: 'orange',
        phonetic: '/ˈɔrɪndʒ/',
        isCorrect: false,
        userAnswer: 'orang'
      },
      {
        word: 'apple',
        phonetic: '/ˈæpl/',
        isCorrect: true,
        userAnswer: 'apple'
      },
      {
        word: 'banana',
        phonetic: '/bəˈnɑːnə/',
        isCorrect: true,
        userAnswer: 'banana'
      },
      {
        word: 'orange',
        phonetic: '/ˈɔrɪndʒ/',
        isCorrect: false,
        userAnswer: 'orang'
      }
      // 更多单词将在真实场景中动态加载
    ]
  },

  onLoad: function(options) {
    // 从全局数据或页面参数获取听写结果
    if (app.globalData.dictationResult) {
      const result = app.globalData.dictationResult;
      this.setData({
        dictationTitle: result.title || this.data.dictationTitle,
        correctCount: result.correctCount || this.data.correctCount,
        wrongCount: result.wrongCount || this.data.wrongCount,
        correctRate: result.correctRate || this.data.correctRate,
        timeUsed: result.timeUsed || this.data.timeUsed,
        wordList: result.wordList || this.data.wordList
      });
    }
  },

  // 返回上一页
  onBack: function() {
    wx.navigateBack({
      delta: 1
    });
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
  }
}); 