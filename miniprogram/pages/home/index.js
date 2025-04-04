const app = getApp();

Page({
  data: {
    inputWords: '', // 输入的单词
    wordLists: [],  // 单词列表
    wordCount: 0,   // 单词计数
    recentWords: [] // 最近输入的单词列表
  },

  onLoad: function () {
    // 从云数据库加载单词列表
    this.loadWordLists();

    // 从本地缓存恢复上次输入的单词
    this.loadInputWordsFromStorage();

    // 加载最近输入的单词
    this.loadRecentWords();

    // 清理过期的音频文件
    this.cleanupAudioFiles();
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
  loadInputWordsFromStorage: function () {
    const inputWords = wx.getStorageSync('last_input_words') || '';
    const wordCount = inputWords ? inputWords.split(/\n/).filter(line => line.trim()).length : 0;

    console.log('从缓存加载上次输入的单词:', inputWords);

    this.setData({
      inputWords,
      wordCount
    });

    // 如果有缓存的单词，为其预生成语音
    if (inputWords.trim()) {
      const words = inputWords.split(/\n/).map(word => word.trim()).filter(word => word);
      this.preloadVoicesForCachedWords(words);
    }
  },

  // 为缓存的单词预加载语音
  preloadVoicesForCachedWords: function (words) {
    if (!words || words.length === 0) return;

    console.log('为缓存的单词预加载语音:', words);

    // 处理单词格式，支持英文-中文格式
    const formattedWords = words.map(item => {
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

    // 检查已有多少单词有缓存语音
    let existingVoiceCount = 0;
    for (const item of formattedWords) {
      const cachedVoiceUrl = this.findCachedVoiceFile(item.word);
      if (cachedVoiceUrl) {
        existingVoiceCount++;
      }
    }

    if (existingVoiceCount === formattedWords.length) {
      console.log('所有单词都已有缓存语音，无需预加载');
      return;
    }

    console.log(`${formattedWords.length - existingVoiceCount}个单词需要预加载语音`);

    // 异步生成语音，不阻塞UI
    setTimeout(() => {
      this.generateWordVoices(formattedWords)
        .then(wordsWithVoices => {
          const successCount = wordsWithVoices.filter(w => w.voiceUrl).length;
          console.log(`缓存单词的语音已预加载完成，成功: ${successCount}/${formattedWords.length}`);
        })
        .catch(error => {
          console.error('预加载语音失败:', error);
        });
    }, 1000); // 延迟1秒执行，避免与其他初始化操作冲突
  },

  // 加载最近输入的单词
  loadRecentWords: function () {
    const recentWords = wx.getStorageSync('recent_words') || [];
    this.setData({ recentWords });
  },

  // 保存输入的单词到本地缓存
  saveInputWordsToStorage: function (inputWords) {
    console.log('保存单词到永久缓存:', inputWords);

    wx.setStorage({
      key: 'last_input_words',
      data: inputWords,
      success: () => {
        console.log('单词已成功保存到永久缓存');
      },
      fail: (err) => {
        console.error('保存单词到缓存失败:', err);
      }
    });

    // 将当前输入的单词添加到最近单词列表
    if (inputWords.trim()) {
      const words = inputWords.split(/\n/).map(word => word.trim()).filter(word => word);
      this.addToRecentWords(words);
    }
  },

  // 添加单词到最近单词列表
  addToRecentWords: function (newWords) {
    if (!newWords || newWords.length === 0) return;

    // 获取当前缓存的最近单词
    let recentWords = wx.getStorageSync('recent_words') || [];

    // 为新单词创建对象（包含单词和时间戳）
    const wordsWithTimestamp = newWords.map(word => ({
      word: word,
      timestamp: Date.now(),
      voiceUrl: null // 初始设置为空，后续会生成
    }));

    // 更新列表：添加新单词，移除重复项
    const wordSet = new Set(recentWords.map(item => item.word.toLowerCase()));

    for (const wordItem of wordsWithTimestamp) {
      const lowerWord = wordItem.word.toLowerCase();
      if (!wordSet.has(lowerWord)) {
        recentWords.push(wordItem);
        wordSet.add(lowerWord);
      } else {
        // 如果已存在，更新时间戳
        const existingIndex = recentWords.findIndex(item =>
          item.word.toLowerCase() === lowerWord);
        if (existingIndex !== -1) {
          recentWords[existingIndex].timestamp = Date.now();
        }
      }
    }

    // 按时间戳排序（最新的在前）
    recentWords.sort((a, b) => b.timestamp - a.timestamp);

    // 限制最多保存100个最近单词
    if (recentWords.length > 100) {
      // 删除超出限制的单词对应的音频文件
      const removedWords = recentWords.slice(100);
      this.removeAudioFiles(removedWords);

      // 只保留100个单词
      recentWords = recentWords.slice(0, 100);
    }

    // 保存到存储
    wx.setStorageSync('recent_words', recentWords);

    // 更新状态
    this.setData({ recentWords });

    // 为新添加的单词生成语音
    this.generateVoicesForRecentWords(wordsWithTimestamp);
  },

  // 为最近单词生成语音文件
  generateVoicesForRecentWords: async function (wordItems) {
    if (!wordItems || wordItems.length === 0) return;

    // 筛选出没有语音URL的单词
    const wordsNeedVoice = wordItems.filter(item => !item.voiceUrl);
    if (wordsNeedVoice.length === 0) return;

    console.log('为最近单词生成语音:', wordsNeedVoice.map(item => item.word));

    try {
      // 对单词进行分类（英文/中文）
      const englishWords = [];
      const chineseWords = [];

      wordsNeedVoice.forEach(item => {
        if (this.isEnglish(item.word)) {
          englishWords.push(item);
        } else {
          chineseWords.push(item);
        }
      });

      // 批量生成英文单词语音
      if (englishWords.length > 0) {
        await this.batchGenerateVoicesForRecent(englishWords, true);
      }

      // 批量生成中文单词语音
      if (chineseWords.length > 0) {
        await this.batchGenerateVoicesForRecent(chineseWords, false);
      }

      // 更新本地存储
      const recentWords = wx.getStorageSync('recent_words') || [];
      wx.setStorageSync('recent_words', recentWords);

      // 更新状态
      this.setData({ recentWords });
    } catch (error) {
      console.error('生成最近单词语音失败:', error);
    }
  },

  // 批量为最近单词生成语音
  batchGenerateVoicesForRecent: async function (wordItems, isEnglish) {
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
  generateSingleVoice: async function (wordItem, isEnglish) {
    try {
      // 先查找是否有缓存的语音文件
      const cachedVoiceUrl = this.findCachedVoiceFile(wordItem.word);
      if (cachedVoiceUrl) {
        console.log(`使用缓存的语音文件: ${wordItem.word}`);
        wordItem.voiceUrl = cachedVoiceUrl;
        return cachedVoiceUrl;
      }

      // 没有缓存，调用接口生成新的语音
      console.log(`生成新的语音文件: ${wordItem.word}`);

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
          "Speed": -2, // 稍微放慢速度，便于听写
          "ProjectId": 0,
          "ModelType": 1,
          "VoiceType": isEnglish ? 101051 : 301004, // 英文用501009，中文用501001
          "PrimaryLanguage": isEnglish ? 2 : 1,     // 英文用2，中文用1
          "SampleRate": 16000,
          "Codec": "mp3",
          "EmotionCategory": isEnglish ? "neutral" : "neutral",
          "EmotionIntensity": 100
        }
      });

      // 检查响应
      if (response.statusCode === 200 && response.data.code === 0 && response.data.data.Audio) {
        // 获取音频Base64数据
        const audioBase64 = response.data.data.Audio;

        // 将Base64转换为永久文件，使用单词作为文件名前缀
        const wordPrefix = wordItem.word.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
        const fileName = `${wordPrefix}_${Date.now()}.mp3`;

        const filePath = await this.base64ToTempFile(audioBase64, fileName);

        // 将语音URL保存到单词对象中
        wordItem.voiceUrl = filePath;

        // 同时更新最近单词列表中的语音URL
        this.updateRecentWordVoiceUrl(wordItem.word, filePath);

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

  // 更新最近单词列表中的语音URL
  updateRecentWordVoiceUrl: function (word, voiceUrl) {
    if (!word || !voiceUrl) return;

    // 获取最近单词列表
    const recentWords = wx.getStorageSync('recent_words') || [];

    // 查找匹配的单词
    const matchIndex = recentWords.findIndex(item =>
      item.word.toLowerCase() === word.toLowerCase());

    if (matchIndex !== -1) {
      // 更新语音URL
      recentWords[matchIndex].voiceUrl = voiceUrl;

      // 保存回存储
      wx.setStorageSync('recent_words', recentWords);

      // 更新UI
      this.setData({ recentWords });
    }
  },

  // 删除音频文件
  removeAudioFiles: function (wordItems) {
    if (!wordItems || wordItems.length === 0) return;

    const fs = wx.getFileSystemManager();

    wordItems.forEach(item => {
      if (item.voiceUrl) {
        try {
          fs.access({
            path: item.voiceUrl,
            success: () => {
              // 文件存在，删除
              fs.unlink({
                filePath: item.voiceUrl,
                success: () => console.log('成功删除音频文件:', item.voiceUrl),
                fail: (err) => console.error('删除音频文件失败:', err)
              });
            },
            fail: () => console.log('音频文件不存在:', item.voiceUrl)
          });
        } catch (error) {
          console.error('删除音频文件出错:', error);
        }
      }
    });
  },

  // 使用最近的单词
  useRecentWord: function (e) {
    const index = e.currentTarget.dataset.index;
    const recentWord = this.data.recentWords[index];

    if (recentWord) {
      // 将选中的单词添加到输入框
      let inputWords = this.data.inputWords;
      if (inputWords && !inputWords.endsWith('\n') && inputWords.length > 0) {
        inputWords += '\n';
      }
      inputWords += recentWord.word;

      // 计算单词数量
      const wordCount = inputWords.split(/\n/).filter(line => line.trim()).length;

      this.setData({
        inputWords,
        wordCount
      });

      // 保存到本地缓存
      this.saveInputWordsToStorage(inputWords);

      // 更新最近单词的时间戳
      this.updateRecentWordTimestamp(index);
    }
  },

  // 更新最近单词的时间戳
  updateRecentWordTimestamp: function (index) {
    const recentWords = [...this.data.recentWords];

    if (recentWords[index]) {
      recentWords[index].timestamp = Date.now();

      // 按时间戳重新排序
      recentWords.sort((a, b) => b.timestamp - a.timestamp);

      // 更新存储和状态
      wx.setStorageSync('recent_words', recentWords);
      this.setData({ recentWords });
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
  clearInput: function () {
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
  sortWords: function () {
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
  processInputText: function (text) {
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

            // 不再过滤识别结果，保留所有检测到的文本
            const allDetections = detections;

            // 处理每一行文本，提取单词
            let allWords = [];

            allDetections.forEach(item => {
              // 分割每行文本中的单词（按逗号、顿号、空格等分隔）
              const lineWords = item.DetectedText
                .split(/[,，、\s]/)  // 添加 \s 匹配空格
                .map(word => word.trim())
                .filter(word => word && word.length > 0);

              allWords = allWords.concat(lineWords);
            });

            // 移除重复单词
            const uniqueWords = [...new Set(allWords)];

            if (uniqueWords.length > 0) {
              // 将单词列表设置到输入框
              this.setData({
                inputWords: uniqueWords.join('\n'),
                wordCount: uniqueWords.length // 更新单词计数
              });

              // 保存到本地缓存
              this.saveInputWordsToStorage(uniqueWords.join('\n'));

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
  startDictation: function () {
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

    console.log('开始处理听写单词，共', wordArray.length, '个单词');

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
        } else {
          console.log('所有单词语音准备完成！');
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
  isEnglish: function (text) {
    // 使用正则表达式判断是否为英文字符（只包含英文字母、数字、标点和空格）
    return /^[A-Za-z0-9\s\.,'\-?!]+$/.test(text);
  },

  // 生成单词语音
  generateWordVoices: async function (words) {
    if (!words || words.length === 0) return words;

    console.log('开始处理单词语音，共计', words.length, '个单词');

    // 先检查每个单词是否有缓存的语音文件
    for (const item of words) {
      const cachedVoiceUrl = this.findCachedVoiceFile(item.word);
      if (cachedVoiceUrl) {
        console.log(`使用缓存的语音文件: ${item.word}`);
        item.voiceUrl = cachedVoiceUrl;
      }
    }

    // 筛选出没有语音URL的单词，需要重新生成
    const wordsNeedVoice = words.filter(item => !item.voiceUrl);

    console.log('需要生成语音的单词数量:', wordsNeedVoice.length);

    if (wordsNeedVoice.length === 0) {
      console.log('所有单词都使用缓存的语音文件');
      return words;
    }

    // 将单词分为英文和中文两组
    const englishWords = [];
    const chineseWords = [];

    wordsNeedVoice.forEach(item => {
      const isEnglish = this.isEnglish(item.word);
      if (isEnglish) {
        englishWords.push(item);
      } else {
        chineseWords.push(item);
      }
    });

    // 批量生成英文单词语音
    if (englishWords.length > 0) {
      console.log('生成英文单词语音:', englishWords.length, '个');
      await this.batchGenerateVoices(englishWords, true);
    }

    // 批量生成中文单词语音
    if (chineseWords.length > 0) {
      console.log('生成中文单词语音:', chineseWords.length, '个');
      await this.batchGenerateVoices(chineseWords, false);
    }

    return words;
  },

  // 批量生成语音
  batchGenerateVoices: async function (wordItems, isEnglish) {
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

  // 将Base64转换为永久文件
  base64ToTempFile: function (base64Data, fileName) {
    return new Promise((resolve, reject) => {
      // 处理文件名，去除中文和特殊字符
      const safeFileName = this.getSafeFileName(fileName);

      // 使用永久目录保存文件
      const filePath = `${wx.env.USER_DATA_PATH}/${safeFileName}`;
      const buffer = wx.base64ToArrayBuffer(base64Data);

      const fs = wx.getFileSystemManager();

      fs.writeFile({
        filePath: filePath,
        data: buffer,
        encoding: 'binary',
        success: () => {
          console.log('语音文件已永久保存:', filePath);

          // 将文件路径记录到全局存储
          const savedAudioFiles = wx.getStorageSync('saved_audio_files') || {};
          savedAudioFiles[safeFileName] = {
            path: filePath,
            timestamp: Date.now()
          };
          wx.setStorageSync('saved_audio_files', savedAudioFiles);

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
  getSafeFileName: function (originalName) {
    // 提取原文件名的扩展名
    const ext = originalName.split('.').pop();

    // 生成随机字符串作为文件名
    const randomName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    // 返回安全的文件名
    return `${randomName}.${ext}`;
  },

  generateVoice: function () {
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

  // 清理过期的音频文件
  cleanupAudioFiles: function () {
    // 获取保存的音频文件列表
    const savedAudioFiles = wx.getStorageSync('saved_audio_files') || {};
    const currentTime = Date.now();
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒数
    const MAX_FILES = 200; // 最多保留200个文件

    // 将文件按时间戳排序
    const sortedFiles = Object.entries(savedAudioFiles)
      .map(([fileName, fileInfo]) => ({
        fileName,
        path: fileInfo.path,
        timestamp: fileInfo.timestamp
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // 最新的在前面

    // 需要删除的文件
    const filesToDelete = [];

    // 1. 标记超过MAX_FILES数量限制的旧文件
    if (sortedFiles.length > MAX_FILES) {
      filesToDelete.push(...sortedFiles.slice(MAX_FILES));
    }

    // 2. 标记超过最大保存时间的文件
    const remainingFiles = sortedFiles.slice(0, MAX_FILES);
    const expiredFiles = remainingFiles.filter(
      file => (currentTime - file.timestamp) > MAX_AGE
    );
    filesToDelete.push(...expiredFiles);

    // 如果有文件需要删除
    if (filesToDelete.length > 0) {
      const fs = wx.getFileSystemManager();
      const updatedSavedFiles = { ...savedAudioFiles };

      console.log(`清理 ${filesToDelete.length} 个过期的音频文件`);

      // 逐个删除文件
      filesToDelete.forEach(file => {
        try {
          fs.access({
            path: file.path,
            success: () => {
              // 文件存在，删除
              fs.unlink({
                filePath: file.path,
                success: () => {
                  console.log('成功删除过期音频文件:', file.path);
                  // 从记录中移除
                  delete updatedSavedFiles[file.fileName];
                },
                fail: (err) => {
                  console.error('删除音频文件失败:', err);
                }
              });
            },
            fail: () => {
              // 文件不存在，直接从记录中移除
              console.log('音频文件不存在，移除记录:', file.path);
              delete updatedSavedFiles[file.fileName];
            }
          });
        } catch (error) {
          console.error('删除音频文件出错:', error);
          // 删除失败也从记录中移除
          delete updatedSavedFiles[file.fileName];
        }
      });

      // 更新存储的文件记录
      wx.setStorageSync('saved_audio_files', updatedSavedFiles);
    } else {
      console.log('没有过期的音频文件需要清理');
    }
  },

  // 根据单词查找已保存的音频文件
  findCachedVoiceFile: function (word) {
    // 获取保存的音频文件记录
    const savedAudioFiles = wx.getStorageSync('saved_audio_files') || {};

    // 检查最近单词列表中是否有匹配的音频
    const recentWords = this.data.recentWords || [];
    const matchedRecentWord = recentWords.find(item =>
      item.word.toLowerCase() === word.toLowerCase() && item.voiceUrl);

    if (matchedRecentWord && matchedRecentWord.voiceUrl) {
      // 检查文件是否存在
      try {
        const fs = wx.getFileSystemManager();
        fs.accessSync(matchedRecentWord.voiceUrl);
        // 文件存在，返回URL
        return matchedRecentWord.voiceUrl;
      } catch (e) {
        // 文件不存在，忽略
      }
    }

    // 如果没有找到匹配的音频文件，返回null
    return null;
  },

}) 