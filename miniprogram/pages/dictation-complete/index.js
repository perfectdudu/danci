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
    wx.navigateBack({
      delta: 1
    });
  },

  // 监听自定义头部高度变化
  onHeaderHeightChange(e) {
    this.setData({
      headerHeight: e.detail
    });
  },

  onLoad: function (options) {
    // 获取serial参数
    if (options.serial) {
      // 从本地存储中获取听写记录
      const records = wx.getStorageSync('dictationRecords') || [];
      const record = records.find(r => r.serial === options.serial);
      
      if (record) {
        // 找到记录，设置到数据中
        this.setData({
          recordData: record,
          wordList: Array.isArray(record.words) ? record.words.map(item => 
            typeof item === 'object' ? item.word : item) : [],
          dictationTitle: record.title || '未命名听写'
        });
        
        console.log('加载记录数据:', record);
        console.log('解析后的单词列表:', this.data.wordList);
        
        // 如果有图片URL，显示图片
        if (app.globalData.currentImageUrl) {
          this.setData({
            imageUrl: app.globalData.currentImageUrl
          });
        }
      } else {
        console.error('未找到匹配的听写记录:', options.serial);
        wx.showToast({
          title: '未找到听写记录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } else {
      console.error('缺少serial参数');
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
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
  processOcrImage: async function(tempFilePath) {
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
        
        // 过滤掉无关文本
        const filteredDetections = detections.filter(item => {
          const text = item.DetectedText.toLowerCase();
          return !text.includes('结果:') && 
                 !text.includes('广告:') && 
                 !text.includes('下载>');
        });
        
        // 处理每一行文本，提取单词
        let allWords = [];
        
        filteredDetections.forEach(item => {
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
  compareWords: function() {
    const originalWords = this.data.wordList;
    const actualWords = this.data.ocrResult;
    
    if (!originalWords.length || !actualWords.length) {
      return;
    }
    
    // 结果数组，保存匹配结果
    const matchResults = [];
    
    // 临时复制一份ocrResult，以便我们可以标记已匹配的单词
    const availableActualWords = [...actualWords];
    
    // 对每个原始单词进行处理
    originalWords.forEach(originalWord => {
      // 尝试查找完全匹配的单词
      const exactMatchIndex = availableActualWords.findIndex(
        actualWord => actualWord.toLowerCase() === originalWord.toLowerCase()
      );
      
      if (exactMatchIndex !== -1) {
        // 找到了完全匹配
        matchResults.push({
          original: originalWord,
          actual: availableActualWords[exactMatchIndex],
          isCorrect: true
        });
        
        // 从可用列表中移除此单词，确保1对1匹配
        availableActualWords.splice(exactMatchIndex, 1);
      } else {
        // 没有完全匹配，查找最接近的单词
        if (availableActualWords.length > 0) {
          // 计算每个候选词与原始词的相似度
          const similarities = availableActualWords.map(actualWord => ({
            word: actualWord,
            similarity: this.calculateSimilarity(originalWord.toLowerCase(), actualWord.toLowerCase())
          }));
          
          // 按相似度降序排序
          similarities.sort((a, b) => b.similarity - a.similarity);
          
          // 取相似度最高的单词
          const bestMatch = similarities[0];
          
          // 相似度阈值，低于这个值就认为是完全不同的单词
          const similarityThreshold = 0.3;
          
          if (bestMatch.similarity >= similarityThreshold) {
            // 找到了相似单词
            matchResults.push({
              original: originalWord,
              actual: bestMatch.word,
              isCorrect: false // 相似但不完全匹配，标记为错误
            });
            
            // 从可用列表中移除此单词
            const index = availableActualWords.indexOf(bestMatch.word);
            availableActualWords.splice(index, 1);
          } else {
            // 没有找到合适的匹配
            matchResults.push({
              original: originalWord,
              actual: '', // 空字符串表示未找到匹配
              isCorrect: false
            });
          }
        } else {
          // 实际单词列表已用尽，表示未找到匹配
          matchResults.push({
            original: originalWord,
            actual: '',
            isCorrect: false
          });
        }
      }
    });
    
    // 保存匹配结果
    this.setData({
      matchedWords: matchResults
    });
    
    console.log('匹配结果:', matchResults);
  },
  
  // 计算两个字符串的相似度（使用Levenshtein距离）
  calculateSimilarity: function(str1, str2) {
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;
    
    // 创建距离矩阵
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    // 初始化
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // 计算距离
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1.charAt(i - 1) === str2.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // 删除
          matrix[i][j - 1] + 1, // 插入
          matrix[i - 1][j - 1] + cost // 替换或匹配
        );
      }
    }
    
    // 计算相似度 (0-1之间的值，1表示完全相同)
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
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
  isEnglish: function(text) {
    if (!text) return true;
    return /^[a-zA-Z0-9\s\.\,\?\!\-\'\"]+$/.test(text);
  },
  
  // 格式化日期 YYYY-MM-DD
  formatDate: function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // 提交听写结果到服务器
  submitDictationResult: async function(title) {
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
                url: `/pages/dictation-result/index?serial=${serial}`,
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
  recordAdd: async function(name, words, errorWords, picUrl) {
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