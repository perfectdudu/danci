const app = getApp();

Page({
  data: {
    recordData: null, // 听写记录数据
    wordList: [], // 单词列表
    matchedWords: [], // 匹配后的单词（包含原始词和对应的实际词）
    dictationTitle: '', // 听写标题
    uploadedImage: '', // 上传的图片
    ocrResult: [], // OCR识别结果
    imageFileId: '', // 上传到云存储的图片ID
    imageUrl: '', // 图片URL
    headerHeight: 0, // 头部高度
    processingOcr: false, // 是否正在处理OCR
    processingComplete: false // 是否处理完成
  },

  // 处理导航栏返回按钮点击
  onBackClick() {
    // 如果还没有上传听写结果，显示二次确认框
    wx.showModal({
      title: '返回确认',
      content: '您还没有上传听写结果，是否需要返回重新听写？',
      confirmText: '是',
      cancelText: '否',
      success: (res) => {
        if (res.confirm) {
          // 用户确认返回，返回到听写页面重新听写
          wx.navigateBack({
            delta: 2
          });
        }
        // 用户点击取消，留在当前页面
      }
    });
  },

  // 监听自定义头部高度变化
  onHeaderHeightChange(e) {
    this.setData({
      headerHeight: e.detail
    });
  },

  onLoad: function (options) {
    // 从本地缓存中获取当前听写记录
    const currentRecord = wx.getStorageSync('currentDictationRecord');
    
    if (currentRecord) {
      // 找到记录，设置到数据中
      this.setData({
        recordData: currentRecord,
        wordList: Array.isArray(currentRecord.words) ? currentRecord.words.map(item =>
          typeof item === 'object' ? item.word : item) : [],
        dictationTitle: currentRecord.title || '未命名听写'
      });

      console.log('加载当前听写记录数据:', currentRecord);
      console.log('解析后的单词列表:', this.data.wordList);

      // 如果有图片URL，显示图片
      if (app.globalData.currentImageUrl) {
        this.setData({
          imageUrl: app.globalData.currentImageUrl
        });
      }
    } else {
      // 如果找不到当前记录，尝试从dictationRecords中获取最新的记录
      const records = wx.getStorageSync('dictationRecords') || [];
      if (records.length > 0) {
        const latestRecord = records[0]; // 最新的记录在数组最前面
        
        this.setData({
          recordData: latestRecord,
          wordList: Array.isArray(latestRecord.words) ? latestRecord.words.map(item =>
            typeof item === 'object' ? item.word : item) : [],
          dictationTitle: latestRecord.title || '未命名听写'
        });
        
        console.log('加载最新听写记录数据:', latestRecord);
        console.log('解析后的单词列表:', this.data.wordList);
        
        // 如果有图片URL，显示图片
        if (app.globalData.currentImageUrl) {
          this.setData({
            imageUrl: app.globalData.currentImageUrl
          });
        }
      } else {
        console.error('未找到听写记录');
        wx.showToast({
          title: '未找到听写记录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    }
  },

  // 上传图片
  uploadImage: function () {
    if (this.data.processingOcr) {
      wx.showToast({
        title: '正在处理中，请稍候',
        icon: 'none'
      });
      return;
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: res => {
        const tempFilePath = res.tempFiles[0].tempFilePath;

        this.setData({
          uploadedImage: tempFilePath,
          processingOcr: true
        });

        wx.showLoading({
          title: '上传和识别中...',
          mask: true
        });

        // 处理识别流程
        this.processOcrImage(tempFilePath);
      }
    });
  },

  // 处理OCR图片识别
  processOcrImage: async function (tempFilePath) {
    try {
      // 1. 上传图片到云存储
      const cloudPath = `ocr_images/${Date.now()}-${Math.random().toString(36).substr(2)}.png`;

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath
      });

      if (!uploadRes.fileID) {
        throw new Error('上传失败');
      }

      // 保存文件ID
      this.setData({
        imageFileId: uploadRes.fileID
      });

      // 2. 获取云存储图片临时链接
      const fileRes = await wx.cloud.getTempFileURL({
        fileList: [uploadRes.fileID]
      });

      if (!fileRes.fileList || !fileRes.fileList[0].tempFileURL) {
        throw new Error('获取图片链接失败');
      }

      const imageUrl = fileRes.fileList[0].tempFileURL;
      console.log('图片临时链接:', imageUrl);

      // 保存图片URL
      this.setData({
        imageUrl: imageUrl
      });

      // 3. 调用OCR识别接口
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

      // 根据API数据格式处理OCR结果
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
          // 分割每行文本中的单词（按空格、逗号、分号等分隔）
          const lineWords = item.DetectedText
            .split(/[,，、;；\s]/)
            .map(word => word.trim())
            .filter(word => word && word.length > 0);

          allWords = allWords.concat(lineWords);
        });

        // 移除重复单词
        const uniqueWords = [...new Set(allWords)];

        if (uniqueWords.length > 0) {
          // 保存OCR识别结果
          this.setData({
            ocrResult: uniqueWords,
            processingOcr: false,
            processingComplete: true
          });

          // 对比原始单词和识别结果
          this.compareWords();

          wx.hideLoading();
          wx.showToast({
            title: `识别到${uniqueWords.length}个单词`,
            icon: 'success'
          });
        } else {
          this.setData({
            processingOcr: false
          });

          wx.hideLoading();
          wx.showToast({
            title: '未识别到有效单词',
            icon: 'none'
          });
        }
      } else {
        console.error('OCR响应异常:', ocrRes);
        this.setData({
          processingOcr: false
        });

        wx.hideLoading();
        wx.showToast({
          title: '识别失败: 服务响应异常',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('OCR处理失败:', err);
      this.setData({
        processingOcr: false
      });

      wx.hideLoading();
      wx.showToast({
        title: '识别失败: ' + err.message,
        icon: 'none'
      });
    }
  },

  // 对比原始单词和识别单词
  compareWords: function () {
    const originalWords = this.data.wordList;
    const actualWords = this.data.ocrResult;

    if (!originalWords.length || !actualWords.length) {
      return;
    }

    console.log('开始匹配单词 - 原始单词:', originalWords);
    console.log('开始匹配单词 - 识别单词:', actualWords);

    // 结果数组，保存匹配结果
    const matchResults = [];

    // 创建原始单词和实际单词的副本，用于处理
    const remainingOriginals = [...originalWords];
    const availableActuals = [...actualWords];

    // 创建标记数组，用于跟踪哪些实际单词已经被匹配
    const actualUsed = new Array(availableActuals.length).fill(false);

    // 第一阶段：寻找完全匹配
    for (let i = 0; i < remainingOriginals.length; i++) {
      let originalWord = remainingOriginals[i];
      let foundExact = false;

      // 寻找完全匹配
      for (let j = 0; j < availableActuals.length; j++) {
        if (actualUsed[j]) continue; // 跳过已使用的单词

        if (originalWord.toLowerCase() === availableActuals[j].toLowerCase()) {
          // 找到完全匹配
          matchResults.push({
            original: originalWord,
            actual: availableActuals[j],
            isCorrect: true,
            stage: 1 // 标记是第一阶段匹配的
          });

          // 标记这个实际单词已被使用
          actualUsed[j] = true;
          foundExact = true;
          break;
        }
      }

      // 如果这个原始单词找到了完全匹配，从待处理列表移除
      if (foundExact) {
        remainingOriginals.splice(i, 1);
        i--; // 调整索引
      }
    }

    console.log('阶段1完成 - 完全匹配结果:', matchResults);
    console.log('阶段1完成 - 剩余原始单词:', remainingOriginals);

    // 统计尚未使用的实际单词
    const remainingActuals = [];
    const lowerCaseMap = {}; // 用于存储已添加单词的小写形式

    for (let j = 0; j < availableActuals.length; j++) {
      if (!actualUsed[j]) {
        const lowerWord = availableActuals[j].toLowerCase();
        // 确保大小写不同的同一单词不会被重复添加
        if (!lowerCaseMap[lowerWord]) {
          remainingActuals.push(availableActuals[j]);
          lowerCaseMap[lowerWord] = true;
        }
      }
    }

    console.log('阶段1完成 - 剩余听写单词:', remainingActuals);

    // 第二阶段：对剩余单词查找最佳部分匹配
    if (remainingOriginals.length > 0 && remainingActuals.length > 0) {
      // 对于每个剩余的原始单词，找出最佳匹配
      const potentialMatches = [];

      // 计算所有可能的匹配对
      for (let i = 0; i < remainingOriginals.length; i++) {
        const original = remainingOriginals[i].toLowerCase();

        for (let j = 0; j < remainingActuals.length; j++) {
          const actual = remainingActuals[j].toLowerCase();

          // 计算最长公共子串长度
          const matchLength = this.longestCommonSubstringLength(original, actual);

          if (matchLength > 0) {
            potentialMatches.push({
              originalIndex: i,
              actualIndex: j,
              original: remainingOriginals[i],
              actual: remainingActuals[j],
              matchLength: matchLength,
              matchRatio: matchLength / original.length,
              lowerActual: actual // 保存小写形式便于后续去重
            });
          }
        }
      }

      // 按匹配长度和匹配率排序
      potentialMatches.sort((a, b) => {
        if (b.matchLength !== a.matchLength) {
          return b.matchLength - a.matchLength; // 优先考虑匹配长度
        }
        return b.matchRatio - a.matchRatio; // 其次考虑匹配率
      });

      console.log('阶段2 - 所有可能的匹配对:', potentialMatches);

      // 贪心算法：选择最佳匹配
      // 使用集合来追踪已被匹配的单词索引
      const matchedOriginalIndices = new Set();
      const matchedActualLowerWords = new Set(); // 使用小写单词集合而非索引

      for (const match of potentialMatches) {
        // 确保两个单词都尚未被匹配 - 使用小写单词进行检查确保大小写变体被视为同一单词
        if (!matchedOriginalIndices.has(match.originalIndex) &&
          !matchedActualLowerWords.has(match.lowerActual)) {

          // 添加到结果
          matchResults.push({
            original: match.original,
            actual: match.actual,
            isCorrect: false,
            matchLength: match.matchLength,
            matchRatio: match.matchRatio.toFixed(2),
            stage: 2 // 标记是第二阶段匹配的
          });

          // 记录已匹配索引和小写单词
          matchedOriginalIndices.add(match.originalIndex);
          matchedActualLowerWords.add(match.lowerActual);
        }
      }

      // 第三阶段：处理剩余未匹配的原始单词
      for (let i = 0; i < remainingOriginals.length; i++) {
        if (!matchedOriginalIndices.has(i)) {
          matchResults.push({
            original: remainingOriginals[i],
            actual: '',
            isCorrect: false,
            stage: 3 // 标记是第三阶段处理的
          });
        }
      }
    } else {
      // 如果没有足够的实际单词匹配，所有剩余原始单词都标记为未匹配
      for (const original of remainingOriginals) {
        matchResults.push({
          original: original,
          actual: '',
          isCorrect: false,
          stage: 3
        });
      }
    }

    // 保存匹配结果
    this.setData({
      matchedWords: matchResults
    });

    // 验证每个实际单词是否只被匹配一次
    this.validateMatching(matchResults, actualWords);

    console.log('匹配完成 - 最终结果:', matchResults);
  },

  // 验证匹配结果，确保没有重复匹配
  validateMatching: function (matchResults, actualWords) {
    const matchedActuals = matchResults
      .filter(match => match.actual !== '') // 排除未匹配的原始单词
      .map(match => match.actual.toLowerCase()); // 转换为小写进行比较

    // 检查是否有重复 - 大小写不敏感
    const usedMap = {};
    let hasError = false;

    for (const word of matchedActuals) {
      if (usedMap[word]) {
        console.error(`验证失败: 单词 "${word}" 被匹配了多次!`);
        hasError = true;
      } else {
        usedMap[word] = true;
      }
    }

    // 检查是否所有匹配的单词都是来自实际单词列表 - 大小写不敏感
    const actualWordsLower = actualWords.map(w => w.toLowerCase());
    for (const word of matchedActuals) {
      if (!actualWordsLower.includes(word)) {
        console.error(`验证失败: 匹配结果中的单词 "${word}" 不在原始听写单词列表中!`);
        hasError = true;
      }
    }

    // 检查听写单词是否被使用了多次
    const matchedByOriginal = {};
    for (const match of matchResults) {
      if (match.actual) {
        const lowerActual = match.actual.toLowerCase();
        if (!matchedByOriginal[lowerActual]) {
          matchedByOriginal[lowerActual] = [];
        }
        matchedByOriginal[lowerActual].push(match.original);
      }
    }

    // 找出被多个原始单词匹配的听写单词
    for (const [actual, originals] of Object.entries(matchedByOriginal)) {
      if (originals.length > 1) {
        console.error(`验证失败: 听写单词 "${actual}" 被多个原始单词匹配: ${originals.join(', ')}`);
        hasError = true;
      }
    }

    if (hasError) {
      console.error('匹配验证失败! 请检查算法逻辑');
    } else {
      console.log('匹配验证通过: 没有重复匹配');
    }

    // 计算统计数据
    const correctCount = matchResults.filter(r => r.isCorrect).length;
    const wrongCount = matchResults.filter(r => !r.isCorrect && r.actual !== '').length;
    const missedCount = matchResults.filter(r => r.actual === '').length;

    console.log(`匹配统计: 正确(${correctCount}), 错误(${wrongCount}), 未匹配(${missedCount}), 总计(${matchResults.length})`);
  },

  // 计算两个字符串的最长公共子串长度
  longestCommonSubstringLength: function (str1, str2) {
    if (!str1 || !str2) return 0;

    const m = str1.length;
    const n = str2.length;
    let maxLength = 0;

    // 创建二维数组记录匹配长度
    const dp = Array(m + 1).fill().map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
          maxLength = Math.max(maxLength, dp[i][j]);
        }
      }
    }

    return maxLength;
  },

  // 保存听写结果
  saveDictationResult: function () {
    if (!this.data.processingComplete) {
      wx.showToast({
        title: '请先上传并识别听写结果',
        icon: 'none'
      });
      return;
    }

    // 获取错误单词的统计
    const errorWords = this.data.matchedWords.filter(word => !word.isCorrect);

    // 准备弹窗输入框内容
    const defaultTitle = `单词听写${this.formatDate(new Date())}${this.isEnglish(this.data.wordList[0]) ? '英语' : '语文'}`;

    // 显示弹窗让用户输入名称
    wx.showModal({
      title: '核对听写结果',
      editable: true,
      placeholderText: '请输入听写名称',
      content: defaultTitle,
      confirmText: '确认提交',
      success: res => {
        if (res.confirm) {
          const title = res.content.trim() || defaultTitle;

          // 调用API保存记录
          this.submitDictationResult(title);
        }
      }
    });
  },

  // 检查文本是否为英文
  isEnglish: function (text) {
    if (!text) return true;
    return /^[a-zA-Z0-9\s\.\,\?\!\-\'\"]+$/.test(text);
  },

  // 格式化日期 YYYY-MM-DD
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 提交听写结果到服务器
  submitDictationResult: async function (title) {
    if (!this.data.recordData || !this.data.matchedWords.length) {
      wx.showToast({
        title: '无效的听写数据',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '提交中...',
      mask: true
    });

    try {
      // 准备原始单词字符串
      const originalWords = this.data.wordList.join(',');

      // 准备错误单词字符串（原始词-错误词格式）
      const errorWordsList = this.data.matchedWords
        .filter(word => !word.isCorrect)
        .map(word => `${word.original}-${word.actual}`);

      const errorWords = errorWordsList.join(',');

      // 调用API添加记录
      const result = await this.recordAdd(title, originalWords, errorWords, this.data.imageUrl);

      wx.hideLoading();

      // 根据新的API返回格式处理结果
      if (result && result.data && result.data.code === 200) {
        // 获取返回的serial
        const serial = result.data.data.serial;

        console.log('提交成功，获取到serial:', serial);

        wx.showToast({
          title: '提交成功',
          icon: 'success',
          duration: 1500,
          mask: true,
          success: () => {
            // 提示后立即跳转到dictation-result页面
            setTimeout(() => {
              wx.navigateTo({
                url: `/pages/dictation-result/index?serial=${serial}&fromPage=complete`,
                success: () => {
                  console.log('成功跳转到听写结果页面');
                },
                fail: (err) => {
                  console.error('跳转失败:', err);
                }
              });
            }, 1000);
          }
        });
      } else {
        console.error('提交失败，接口返回:', result);
        wx.showToast({
          title: '提交失败: ' + (result?.data?.msg || '未知错误'),
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('提交结果失败:', error);
      wx.showToast({
        title: '提交失败: ' + error.message,
        icon: 'none'
      });
    }
  },

  // 调用API添加记录
  recordAdd: async function (name, words, errorWords, picUrl) {
    return await wx.cloud.callContainer({
      "config": {
        "env": "prod-5g5ywun6829a4db5"
      },
      "path": "/record/add",
      "header": {
        "X-WX-SERVICE": "word-dictation",
        "content-type": "application/json",
        "Authorization": `Bearer ${app.globalData.token}`
      },
      "method": "POST",
      "data": {
        "name": name,
        "words": words,
        "error_words": errorWords,
        "pic_url": picUrl
      }
    });
  }
}) 