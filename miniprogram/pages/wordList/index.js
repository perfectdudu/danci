const app = getApp();

Page({
  data: {
    id: '', // 单词列表ID
    title: '', // 单词列表标题
    wordsText: '', // 单词文本
    isEditing: false // 是否是编辑现有列表
  },

  // 处理导航栏返回按钮点击
  onBackClick() {
    wx.switchTab({
      url: '/pages/home/index'
    });
  },

  onLoad: function (options) {
    // 如果有传入ID，则加载现有单词列表
    if (options.id) {
      this.setData({
        id: options.id,
        isEditing: true
      });
      
      this.loadWordList(options.id);
    }
  },

  // 加载单词列表
  loadWordList: function (id) {
    // 从全局变量中查找单词列表
    const wordList = app.globalData.wordLists.find(item => item.id === id);
    
    if (wordList) {
      this.setData({
        title: wordList.title,
        wordsText: wordList.words.join('\n')
      });
    } else {
      wx.showToast({
        title: '未找到单词列表',
        icon: 'none'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 标题变化
  onTitleChange: function (e) {
    this.setData({
      title: e.detail.value
    });
  },

  // 单词文本变化
  onWordsChange: function (e) {
    this.setData({
      wordsText: e.detail.value
    });
  },

  // 清空单词
  clearWords: function () {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有单词吗？',
      success: res => {
        if (res.confirm) {
          this.setData({
            wordsText: ''
          });
        }
      }
    });
  },

  // 排序单词
  sortWords: function () {
    const words = this.data.wordsText.trim().split(/[\n\r]+/).map(word => word.trim()).filter(word => word);
    
    if (words.length === 0) {
      wx.showToast({
        title: '没有单词可排序',
        icon: 'none'
      });
      return;
    }
    
    // 按字母顺序排序
    words.sort((a, b) => a.localeCompare(b, 'en'));
    
    this.setData({
      wordsText: words.join('\n')
    });
    
    wx.showToast({
      title: '排序完成'
    });
  },

  // 拍照识别单词
  scanWords: function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: res => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        wx.showLoading({
          title: '识别中...',
        });
        
        // 调用云函数进行 OCR 识别
        wx.cloud.callFunction({
          name: 'ocrWords',
          data: {
            fileID: tempFilePath
          }
        }).then(res => {
          wx.hideLoading();
          
          if (res.result && res.result.words) {
            // 将识别结果添加到现有单词后面
            const currentWords = this.data.wordsText.trim();
            const newWords = res.result.words.join('\n');
            
            this.setData({
              wordsText: currentWords ? `${currentWords}\n${newWords}` : newWords
            });
            
            wx.showToast({
              title: '识别成功'
            });
          } else {
            wx.showToast({
              title: '未识别到单词',
              icon: 'none'
            });
          }
        }).catch(err => {
          wx.hideLoading();
          console.error('OCR 识别失败：', err);
          wx.showToast({
            title: '识别失败',
            icon: 'none'
          });
        });
      }
    });
  },

  // 保存单词列表
  saveWordList: function () {
    const { id, title, wordsText, isEditing } = this.data;
    
    if (!title.trim()) {
      wx.showToast({
        title: '请输入列表名称',
        icon: 'none'
      });
      return;
    }
    
    if (!wordsText.trim()) {
      wx.showToast({
        title: '请输入单词',
        icon: 'none'
      });
      return;
    }
    
    // 将文本分割为单词数组
    const words = wordsText.trim().split(/[\n\r]+/).map(word => word.trim()).filter(word => word);
    
    if (words.length === 0) {
      wx.showToast({
        title: '没有有效的单词',
        icon: 'none'
      });
      return;
    }
    
    // 创建或更新单词列表对象
    const wordList = {
      title: title.trim(),
      words: words,
      updateTime: new Date()
    };
    
    if (isEditing) {
      // 更新现有列表
      wordList.id = id;
      
      // 如果用户已登录，则更新云数据库
      if (app.globalData.userInfo) {
        const db = wx.cloud.database();
        db.collection('wordLists').where({
          _openid: app.globalData.userInfo.openId,
          id: id
        }).update({
          data: wordList
        }).then(res => {
          console.log('更新单词列表成功', res);
        }).catch(err => {
          console.error('更新单词列表失败：', err);
        });
      }
      
      // 更新全局变量中的列表
      const index = app.globalData.wordLists.findIndex(item => item.id === id);
      if (index !== -1) {
        app.globalData.wordLists[index] = {
          ...app.globalData.wordLists[index],
          ...wordList
        };
      }
      
      wx.showToast({
        title: '更新成功'
      });
    } else {
      // 创建新列表
      wordList.id = Date.now().toString();
      wordList.createTime = new Date();
      
      // 如果用户已登录，则保存到云数据库
      if (app.globalData.userInfo) {
        const db = wx.cloud.database();
        db.collection('wordLists').add({
          data: wordList
        }).then(res => {
          console.log('保存单词列表成功', res);
        }).catch(err => {
          console.error('保存单词列表失败：', err);
        });
      }
      
      // 添加到全局变量
      app.globalData.wordLists.push(wordList);
      
      wx.showToast({
        title: '创建成功'
      });
    }
    
    // 返回上一页
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 取消编辑
  cancel: function () {
    wx.navigateBack();
  }
}) 