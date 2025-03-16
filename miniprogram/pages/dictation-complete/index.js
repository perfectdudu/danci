const app = getApp();

Page({
  data: {
    wordList: [], // 单词列表
    selectedWords: [], // 选中的错误单词
    dictationTitle: '', // 听写标题
    uploadedImage: '', // 上传的图片
    headerHeight: 0  // 头部高度
  },

  // 处理导航栏返回按钮点击
  onBackClick() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 监听自定义头部高度变化
  onHeaderHeightChange(e) {
    this.setData({
      headerHeight: e.detail.height
    });
  },

  onLoad: function (options) {
    // 从全局变量获取当前听写的单词列表
    const words = app.globalData.currentDictationWords || [];
    const title = app.globalData.currentDictationTitle || '临时单词列表';
    
    // 如果没有单词列表，使用模拟数据
    if (words.length === 0) {
      // 模拟数据
      const mockWords = [
        { word: 'book', translation: '书, 书本' },
        { word: 'ruler', translation: '尺子' },
        { word: 'pencil', translation: '铅笔' },
        { word: 'dog', translation: '狗' },
        { word: 'bird', translation: '鸟' },
        { word: 'eight', translation: '八' },
        { word: 'nine', translation: '九' },
        { word: 'banana', translation: '香蕉' },
        { word: 'orange', translation: '橙子, 橘' }
      ];
      
      this.setData({
        wordList: mockWords,
        dictationTitle: '英语基础词汇',
        selectedWords: [] // 初始化选中的单词
      });
      
      return;
    }
    
    // 格式化单词列表
    const wordList = words.map(word => {
      // 如果是字符串，则转为对象
      if (typeof word === 'string') {
        return {
          word: word,
          translation: '' // 暂无翻译
        };
      }
      return word;
    });
    
    this.setData({
      wordList: wordList,
      dictationTitle: title,
      selectedWords: [] // 初始化选中的单词
    });
  },

  // 上传图片
  uploadImage: function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: res => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        this.setData({
          uploadedImage: tempFilePath
        });
        
        // 可以在这里添加图片预览
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
      }
    });
  },

  // 切换单词选中状态
  toggleWordSelection: function (e) {
    const index = e.currentTarget.dataset.index;
    const { selectedWords, wordList } = this.data;
    
    // 检查是否已选中
    const isSelected = selectedWords.includes(index);
    
    if (isSelected) {
      // 如果已选中，则取消选中
      const newSelectedWords = selectedWords.filter(i => i !== index);
      this.setData({
        selectedWords: newSelectedWords
      });
      
      // 更新单词项样式
      const wordItem = this.selectComponent(`#word-${index}`);
      if (wordItem) {
        wordItem.setData({
          selected: false
        });
      }
    } else {
      // 如果未选中，则选中
      const newSelectedWords = [...selectedWords, index];
      this.setData({
        selectedWords: newSelectedWords
      });
      
      // 更新单词项样式
      const wordItem = this.selectComponent(`#word-${index}`);
      if (wordItem) {
        wordItem.setData({
          selected: true
        });
      }
    }
  },

  // 保存听写结果
  saveDictationResult: function () {
    const { wordList, selectedWords, dictationTitle, uploadedImage } = this.data;
    
    // 检查是否上传了图片
    // if (!uploadedImage) {
    //   wx.showToast({
    //     title: '请先上传听写结果图片',
    //     icon: 'none'
    //   });
    //   return;
    // }
    
    // 生成听写结果
    const result = {
      id: Date.now().toString(),
      title: dictationTitle,
      date: new Date(),
      words: wordList.map((item, index) => {
        return {
          word: item.word,
          translation: item.translation,
          correct: !selectedWords.includes(index),
          userAnswer: selectedWords.includes(index) ? '' : item.word // 如果选中为错误，则用户答案为空
        };
      }),
      correctCount: wordList.length - selectedWords.length,
      wrongCount: selectedWords.length,
      accuracy: Math.round(((wordList.length - selectedWords.length) / wordList.length) * 100),
      timeSpent: '未记录', // 这里可以添加听写用时
      imagePath: uploadedImage
    };
    
    // 保存到全局变量
    app.globalData.currentDictationResult = result;
    
    // 保存到云数据库
    if (app.globalData.userInfo) {
      const db = wx.cloud.database();
      db.collection('dictationRecords').add({
        data: result
      }).then(res => {
        console.log('保存听写记录成功', res);
        
        // 跳转到结果页面
        wx.redirectTo({
          url: '/pages/result/index'
        });
      }).catch(err => {
        console.error('保存听写记录失败：', err);
        
        // 仍然跳转到结果页面
        wx.redirectTo({
          url: '/pages/dictation-result/index'
        });
      });
    } else {
      // 未登录用户直接跳转到结果页面
      wx.redirectTo({
        url: '/pages/dictation-result/index'
      });
    }
  }
}) 