const app = getApp();

Page({
  data: {
    inputWords: '', // 输入的单词
    wordLists: [],  // 单词列表
    wordCount: 0    // 单词计数
  },

  onLoad: function () {
    // 从云数据库加载单词列表
    this.loadWordLists();
  },

  onShow: function () {
    // 每次显示页面时更新单词列表
    this.loadWordLists();
    
    // 更新自定义tabbar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      });
    }
  },

  // 加载单词列表
  loadWordLists: function () {
    const db = wx.cloud.database();
    
    // 如果用户已登录，则获取该用户的单词列表，否则使用全局示例数据
    if (app.globalData.userInfo) {
      db.collection('wordLists')
        .where({
          _openid: app.globalData.userInfo.openId
        })
        .get()
        .then(res => {
          this.setData({
            wordLists: res.data
          });
          // 同时更新全局数据
          app.globalData.wordLists = res.data;
        })
        .catch(err => {
          console.error('获取单词列表失败：', err);
          wx.showToast({
            title: '加载单词列表失败',
            icon: 'none'
          });
        });
    } else {
      // 使用示例数据
      const exampleWordLists = [
        {
          id: 'example1',
          title: '英语四级词汇',
          words: ['apple', 'banana', 'orange', 'grape', 'watermelon']
        },
        {
          id: 'example2',
          title: '英语六级核心词汇',
          words: ['accommodate', 'necessary', 'embarrass', 'occurrence']
        }
      ];
      
      this.setData({
        wordLists: exampleWordLists
      });
      app.globalData.wordLists = exampleWordLists;
    }
  },

  // 处理输入变化
  onInputChange: function (e) {
    const inputText = e.detail.value;
    
    // 计算单词数量
    const lines = inputText.split(/\n/).filter(line => line.trim());
    const wordCount = lines.length;
    
    // 限制最多输入100个单词
    if (wordCount > 100) {
      wx.showToast({
        title: '最多输入100个单词',
        icon: 'none'
      });
      // 只保留前100个单词
      const limitedText = lines.slice(0, 100).join('\n');
      this.setData({
        inputWords: limitedText,
        wordCount: 100
      });
      return;
    }
    
    this.setData({
      inputWords: inputText,
      wordCount: wordCount
    });
  },

  // 清空输入框
  clearInput: function() {
    // 添加二次确认对话框
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有输入的单词吗？',
      confirmColor: '#4CAF50',
      success: res => {
        if (res.confirm) {
          // 用户点击确定，清空输入框
          this.setData({
            inputWords: '',
            wordCount: 0
          });
          
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
        // 用户点击取消，不执行任何操作
      }
    });
  },
  
  // 排序单词
  sortWords: function() {
    const inputText = this.data.inputWords.trim();
    
    if (!inputText) {
      wx.showToast({
        title: '请先输入单词',
        icon: 'none'
      });
      return;
    }
    
    // 将文本分割为单词数组
    const wordArray = inputText.split(/\n/).map(word => word.trim()).filter(word => word);
    
    if (wordArray.length <= 1) {
      wx.showToast({
        title: '至少需要两个单词',
        icon: 'none'
      });
      return;
    }
    
    // 按字母顺序排序
    const sortedWords = [...wordArray].sort((a, b) => {
      // 去除可能的翻译部分，只比较单词部分
      const wordA = a.split(/[^\w']/, 1)[0].toLowerCase();
      const wordB = b.split(/[^\w']/, 1)[0].toLowerCase();
      return wordA.localeCompare(wordB);
    });
    
    // 更新输入框
    this.setData({
      inputWords: sortedWords.join('\n')
    });
    
    wx.showToast({
      title: '排序完成',
      icon: 'success'
    });
  },

  // 处理输入文本，区分英文和中文
  processInputText: function(text) {
    if (!text) return '';
    
    // 这里可以添加文本处理逻辑
    // 例如：检测每行是否包含英文和中文，并添加相应的样式
    return text;
  },

  // 保存单词列表
  saveWordList: function () {
    const words = this.data.inputWords.trim();
    
    if (!words) {
      wx.showToast({
        title: '请输入单词',
        icon: 'none'
      });
      return;
    }
    
    // 将文本分割为单词数组
    const wordArray = words.split(/[\n\r]+/).map(word => word.trim()).filter(word => word);
    
    if (wordArray.length === 0) {
      wx.showToast({
        title: '没有有效的单词',
        icon: 'none'
      });
      return;
    }
    
    // 弹出对话框让用户输入单词列表名称
    wx.showModal({
      title: '保存单词列表',
      editable: true,
      placeholderText: '请输入单词列表名称',
      success: res => {
        if (res.confirm) {
          const title = res.content.trim();
          
          if (!title) {
            wx.showToast({
              title: '请输入单词列表名称',
              icon: 'none'
            });
            return;
          }
          
          // 创建新的单词列表
          const newWordList = {
            id: Date.now().toString(),
            title: title,
            words: wordArray,
            createTime: new Date()
          };
          
          // 保存到云数据库
          if (app.globalData.userInfo) {
            const db = wx.cloud.database();
            db.collection('wordLists').add({
              data: newWordList
            }).then(res => {
              // 更新本地数据
              const updatedWordLists = [...this.data.wordLists, newWordList];
              this.setData({
                wordLists: updatedWordLists,
                inputWords: '' // 清空输入框
              });
              
              // 更新全局数据
              app.globalData.wordLists = updatedWordLists;
              
              wx.showToast({
                title: '保存成功'
              });
            }).catch(err => {
              console.error('保存单词列表失败：', err);
              wx.showToast({
                title: '保存失败',
                icon: 'none'
              });
            });
          } else {
            // 如果用户未登录，只在本地保存
            const updatedWordLists = [...this.data.wordLists, newWordList];
            this.setData({
              wordLists: updatedWordLists,
              inputWords: '' // 清空输入框
            });
            
            // 更新全局数据
            app.globalData.wordLists = updatedWordLists;
            
            wx.showToast({
              title: '保存成功（本地）'
            });
          }
        }
      }
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
            // 将识别结果填入输入框
            this.setData({
              inputWords: res.result.words.join('\n')
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

  // 开始听写
  startDictation: function() {
    const words = this.data.inputWords.trim();
    
    if (!words) {
      wx.showToast({
        title: '请先输入单词',
        icon: 'none'
      });
      return;
    }
    
    // 将文本分割为单词数组
    const wordArray = words.split(/\n/).map(word => word.trim()).filter(word => word);
    
    if (wordArray.length === 0) {
      wx.showToast({
        title: '没有有效的单词',
        icon: 'none'
      });
      return;
    }
    
    // 处理单词格式，支持英文-中文格式
    const formattedWords = wordArray.map(item => {
      const parts = item.split(/[-—_:：]+/).map(part => part.trim());
      if (parts.length > 1) {
        return {
          word: parts[0],
          translation: parts.slice(1).join(', ')
        };
      }
      return {
        word: item,
        translation: ''
      };
    });
    
    // 保存到全局变量
    app.globalData.currentDictationWords = formattedWords;
    app.globalData.currentDictationTitle = '临时单词列表';
    
    // 跳转到听写页面
    wx.navigateTo({
      url: '/pages/dictation/index'
    });
  },

  // 编辑单词列表
  editWordList: function (e) {
    const id = e.currentTarget.dataset.id;
    const wordList = this.data.wordLists.find(item => item.id === id);
    
    if (!wordList) {
      wx.showToast({
        title: '未找到单词列表',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到单词列表编辑页面
    wx.navigateTo({
      url: `/pages/wordList/index?id=${id}`
    });
  },

  // 使用现有单词列表开始听写
  startWordListDictation: function (e) {
    const id = e.currentTarget.dataset.id;
    const wordList = this.data.wordLists.find(item => item.id === id);
    
    if (!wordList) {
      wx.showToast({
        title: '未找到单词列表',
        icon: 'none'
      });
      return;
    }
    
    if (wordList.words.length === 0) {
      wx.showToast({
        title: '单词列表为空',
        icon: 'none'
      });
      return;
    }
    
    // 将单词数组存入全局变量，以便听写页面使用
    app.globalData.currentDictationWords = wordList.words;
    app.globalData.currentDictationTitle = wordList.title;
    
    // 跳转到听写页面
    wx.navigateTo({
      url: '/pages/dictation/index'
    });
  },

  // 删除单词列表
  deleteWordList: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个单词列表吗？',
      success: res => {
        if (res.confirm) {
          // 从云数据库删除
          if (app.globalData.userInfo) {
            const db = wx.cloud.database();
            db.collection('wordLists').where({
              _openid: app.globalData.userInfo.openId,
              id: id
            }).remove().then(res => {
              // 更新本地数据
              const updatedWordLists = this.data.wordLists.filter(item => item.id !== id);
              this.setData({
                wordLists: updatedWordLists
              });
              
              // 更新全局数据
              app.globalData.wordLists = updatedWordLists;
              
              wx.showToast({
                title: '删除成功'
              });
            }).catch(err => {
              console.error('删除单词列表失败：', err);
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              });
            });
          } else {
            // 如果用户未登录，只在本地删除
            const updatedWordLists = this.data.wordLists.filter(item => item.id !== id);
            this.setData({
              wordLists: updatedWordLists
            });
            
            // 更新全局数据
            app.globalData.wordLists = updatedWordLists;
            
            wx.showToast({
              title: '删除成功'
            });
          }
        }
      }
    });
  }
}) 