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
    
    // 从本地缓存恢复上次输入的单词
    this.loadInputWordsFromStorage();
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

  // 从本地缓存恢复上次输入的单词
  loadInputWordsFromStorage: function() {
    const inputWords = wx.getStorageSync('last_input_words') || '';
    const wordCount = inputWords ? inputWords.split(/\n/).filter(line => line.trim()).length : 0;
    
    this.setData({
      inputWords,
      wordCount
    });
  },

  // 保存输入的单词到本地缓存
  saveInputWordsToStorage: function(inputWords) {
    wx.setStorage({
      key: 'last_input_words',
      data: inputWords
    });
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
      
      // 保存到本地缓存
      this.saveInputWordsToStorage(limitedText);
      return;
    }
    
    this.setData({
      inputWords: inputText,
      wordCount: wordCount
    });
    
    // 保存到本地缓存
    this.saveInputWordsToStorage(inputText);
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
          
          // 同时清空本地缓存
          this.saveInputWordsToStorage('');
          
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
    wx.showLoading({
      title: '处理中...',
    });
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async res => {
        try {
          const tempFilePath = res.tempFiles[0].tempFilePath;
          
          // 1. 上传图片到云存储
          const cloudPath = `ocr_images/${Date.now()}-${Math.random().toString(36).substr(2)}.png`;
          
          wx.showLoading({
            title: '上传图片中...',
          });
          
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath
          });
          
          if (!uploadRes.fileID) {
            throw new Error('上传失败');
          }
          
          // 2. 获取云存储图片临时链接
          wx.showLoading({
            title: '获取图片链接...',
          });
          
          const fileRes = await wx.cloud.getTempFileURL({
            fileList: [uploadRes.fileID]
          });
          
          if (!fileRes.fileList || !fileRes.fileList[0].tempFileURL) {
            throw new Error('获取图片链接失败');
          }
          
          const imageUrl = fileRes.fileList[0].tempFileURL;
          console.log('图片临时链接:', imageUrl);
          
          // 保存图片 URL 到当前听写记录
          app.globalData.currentImageUrl = imageUrl;
          
          // 3. 调用OCR识别接口
          wx.showLoading({
            title: '识别文字中...',
          });
          
          const ocrRes = await wx.cloud.callContainer({
            "config": {
              "env": "prod-5g5ywun6829a4db5"
            },
            "path": "/txapi/ocr/handwriting",
            "header": {
              "X-WX-SERVICE": "word-dictation",
              "content-type": "application/json",
              "Authorization": `Bearer ${app.globalData.token}`
            },
            "method": "POST",
            "data": {
              "ImageUrl": imageUrl
            }
          });
          
          wx.hideLoading();
          
          // 根据新的数据格式处理OCR结果
          if (ocrRes.data && 
              ocrRes.data.code === 0 && 
              ocrRes.data.data && 
              ocrRes.data.data.TextDetections) {
            
            // 提取所有文本检测结果
            const detections = ocrRes.data.data.TextDetections;
            
            // 过滤掉"结果:"、"广告:"、"下载>"等无关文本
            const filteredDetections = detections.filter(item => {
              const text = item.DetectedText.toLowerCase();
              return !text.includes('结果:') && 
                     !text.includes('广告:') && 
                     !text.includes('下载>');
            });
            
            // 处理每一行文本，提取单词
            let allWords = [];
            
            filteredDetections.forEach(item => {
              // 分割每行文本中的单词（按逗号分隔）
              const lineWords = item.DetectedText
                .split(/[,，、]/)
                .map(word => word.trim())
                .filter(word => word && word.length > 0);
              
              allWords = allWords.concat(lineWords);
            });
            
            // 移除重复单词
            const uniqueWords = [...new Set(allWords)];
            
            if (uniqueWords.length > 0) {
              // 将单词列表设置到输入框
              this.setData({
                inputWords: uniqueWords.join('\n')
              });
              
              wx.showToast({
                title: `识别到${uniqueWords.length}个单词`,
                icon: 'success'
              });
            } else {
              wx.showToast({
                title: '未识别到有效单词',
                icon: 'none'
              });
            }
          } else {
            console.error('OCR响应异常:', ocrRes);
            wx.showToast({
              title: '识别失败: 服务响应异常',
              icon: 'none'
            });
          }
        } catch (err) {
          wx.hideLoading();
          console.error('OCR识别失败:', err);
          wx.showToast({
            title: '识别失败: ' + err.message,
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.log('选择图片失败:', err);
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
    
    wx.showLoading({
      title: '正在准备语音...',
      mask: true
    });
    
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
    
    // 生成语音，然后开始听写
    this.generateWordVoices(formattedWords)
      .then(wordsWithVoices => {
        // 检查是否所有单词都有语音URL
        const missingVoiceWords = wordsWithVoices.filter(item => !item.voiceUrl);
        
        if (missingVoiceWords.length > 0) {
          // 如果有单词缺少语音，显示警告但仍然继续
          console.warn('部分单词没有生成语音:', missingVoiceWords.map(item => item.word));
          wx.showToast({
            title: `${missingVoiceWords.length}个单词未能生成语音`,
            icon: 'none',
            duration: 2000
          });
        }
        
        // 保存到全局变量
        app.globalData.currentDictationWords = wordsWithVoices;
        app.globalData.currentDictationTitle = '临时单词列表';
        
        wx.hideLoading();
        
        // 跳转到听写页面
        wx.navigateTo({
          url: '/pages/dictation/index'
        });
      })
      .catch(error => {
        wx.hideLoading();
        console.error('语音合成失败:', error);
        
        // 显示更友好的错误信息
        wx.showModal({
          title: '语音合成失败',
          content: '无法生成语音，请检查网络连接或稍后再试。\n错误信息: ' + error.message,
          showCancel: false
        });
      });
  },
  
  // 判断文本是否为英文
  isEnglish: function(text) {
    // 使用正则表达式判断是否为英文字符（只包含英文字母、数字、标点和空格）
    return /^[A-Za-z0-9\s\.,'\-?!]+$/.test(text);
  },
  
  // 生成单词语音
  generateWordVoices: async function(words) {
    if (!words || words.length === 0) return words;
    
    // 将单词分为英文和中文两组
    const englishWords = [];
    const chineseWords = [];
    
    words.forEach(item => {
      const isEnglish = this.isEnglish(item.word);
      
      // 所有单词都添加到待生成列表，不检查缓存
      if (isEnglish) {
        englishWords.push(item);
      } else {
        chineseWords.push(item);
      }
    });
    
    // 批量生成英文单词语音
    if (englishWords.length > 0) {
      await this.batchGenerateVoices(englishWords, true);
    }
    
    // 批量生成中文单词语音
    if (chineseWords.length > 0) {
      await this.batchGenerateVoices(chineseWords, false);
    }
    
    return words;
  },
  
  // 批量生成语音
  batchGenerateVoices: async function(wordItems, isEnglish) {
    // 每批处理的单词数量
    const batchSize = 10;
    
    // 将单词分批处理
    for (let i = 0; i < wordItems.length; i += batchSize) {
      const batch = wordItems.slice(i, i + batchSize);
      
      // 并发处理当前批次的所有单词
      const promises = batch.map(item => this.generateSingleVoice(item, isEnglish));
      
      // 等待当前批次的所有请求完成
      await Promise.all(promises);
    }
  },
  
  // 生成单个单词的语音
  generateSingleVoice: async function(wordItem, isEnglish) {
    try {
      const response = await wx.cloud.callContainer({
        "config": {
          "env": "prod-5g5ywun6829a4db5"
        },
        "path": "/txapi/tts/text2voice",
        "header": {
          "X-WX-SERVICE": "word-dictation",
          "content-type": "application/json",
          "Authorization": `Bearer ${app.globalData.token}`
        },
        "method": "POST",
        "data": {
          "Text": wordItem.word,
          "SessionId": `session-${Date.now()}`, // 使用时间戳确保每次请求唯一
          "Volume": 1,
          "Speed": 1, // 稍微放慢速度，便于听写
          "ProjectId": 0,
          "ModelType": 1,
          "VoiceType": isEnglish ? 101051 : 301004, // 英文用501009，中文用501001
          "PrimaryLanguage": isEnglish ? 2 : 1,     // 英文用2，中文用1
          "SampleRate": 16000,
          "Codec": "mp3",
          "EmotionCategory": isEnglish ? "neutral" : "radio",
          "EmotionIntensity": 100
        }
      });
      
      // 检查响应
      if (response.statusCode === 200 && response.data.code === 0 && response.data.data.Audio) {
        // 获取音频Base64数据
        const audioBase64 = response.data.data.Audio;
        
        // 将Base64转换为临时文件，使用时间戳确保文件名唯一
        const filePath = await this.base64ToTempFile(audioBase64, `audio_${Date.now()}.mp3`);
        
        // 将语音URL保存到单词对象中，但不保存到缓存
        wordItem.voiceUrl = filePath;
        
        return filePath;
      } else {
        console.error('语音合成接口返回错误:', response);
        
        // 输出详细的错误信息，便于调试
        if (response.data) {
          console.error('响应数据:', JSON.stringify(response.data));
        }
        
        throw new Error('语音合成失败: ' + (response.data?.msg || '未知错误'));
      }
    } catch (error) {
      console.error(`生成单词 "${wordItem.word}" 的语音失败:`, error);
      // 出错时不中断整个流程，返回null表示没有语音
      wordItem.voiceUrl = null;
      return null;
    }
  },
  
  // 将Base64转换为临时文件
  base64ToTempFile: function(base64Data, fileName) {
    return new Promise((resolve, reject) => {
      // 处理文件名，去除中文和特殊字符
      const safeFileName = this.getSafeFileName(fileName);
      
      const filePath = `${wx.env.USER_DATA_PATH}/${safeFileName}`;
      const buffer = wx.base64ToArrayBuffer(base64Data);
      
      wx.getFileSystemManager().writeFile({
        filePath: filePath,
        data: buffer,
        encoding: 'binary',
        success: () => {
          resolve(filePath);
        },
        fail: (error) => {
          console.error('写入文件失败:', error);
          reject(error);
        }
      });
    });
  },
  
  // 生成安全的文件名（不含中文和特殊字符）
  getSafeFileName: function(originalName) {
    // 提取原文件名的扩展名
    const ext = originalName.split('.').pop();
    
    // 生成随机字符串作为文件名
    const randomName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    // 返回安全的文件名
    return `${randomName}.${ext}`;
  },

  generateVoice: function() {
    wx.cloud.callContainer({
      "config": {
        "env": "prod-5g5ywun6829a4db5"
      },
      "path": "/txapi/tts/text2voice",
      "header": {
        "X-WX-SERVICE": "word-dictation",
        "content-type": "application/json",
        "Authorization": `Bearer ${app.globalData.token}`
      },
      "method": "POST",
      "data": {
        "Text": "盛大",
        "Volume": 1,
        "Speed": 1,
        "ProjectId": 0,
        "ModelType": 1,
        "VoiceType": 101008,
        "PrimaryLanguage": 1,
        "SampleRate": 16000,
        "Codec": "wav",
        "SegmentRate": 0,
        "EmotionCategory": "neutral",
        "EmotionIntensity": 100
      }
    })
  },

}) 