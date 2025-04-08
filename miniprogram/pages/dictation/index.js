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
    initialPlay: true, // 初始加载状态
    playCount: 0, // 播放次数计数
    playTimer: null, // 播放定时器
    answers: {},  // 初始化答案对象
    isPlayingCompletionAudio: false, // 标记是否正在播放完成提示音
    completionPlayCount: 0, // 完成提示音播放次数计数
    isAudioReady: false, // 标记音频是否已准备好
    autoPlayScheduled: false, // 标记是否已安排自动播放
    allWordsCompleted: false, // 添加标记，表示所有单词已播放完成
    isFinishing: false, // 添加标记，表示正在完成听写流程
    completed: false,
    showWave: false,
  },

  onLoad: function (options) {
    // 初始化播放相关参数
    this.playCount = 1;
    this.playTimer = null;
    this.initialPlay = true; // 标记为初始加载
    this.autoPlayScheduled = false; // 标记是否已安排自动播放
    
    // 开启屏幕常亮
    wx.setKeepScreenOn({
      keepScreenOn: true,
      success: () => {
        console.log('屏幕常亮已开启');
      },
      fail: (err) => {
        console.error('开启屏幕常亮失败:', err);
      }
    });
    
    // 显示音频准备中提示
    wx.showToast({
      title: '音频准备中...',
      icon: 'loading',
      duration: 2000,
      mask: true
    });
    
    // 确保销毁可能存在的旧音频实例
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
    }
    
    // 从全局变量获取单词列表
    const wordList = app.globalData.currentDictationWords || [];
    const title = app.globalData.currentDictationTitle || '临时单词列表';
    
    // 检查是否存在完成提示音，没有则生成
    this.checkCompletionAudio();
    
    if (wordList.length === 0) {
      // 使用模拟数据
      const mockWords = [
        { word: 'book', voiceUrl: null },
        { word: 'ruler', voiceUrl: null },
        { word: 'pencil', voiceUrl: null },
        { word: 'dog', voiceUrl: null },
        { word: 'bird', voiceUrl: null },
        { word: 'eight', voiceUrl: null },
        { word: 'nine', voiceUrl: null },
        { word: 'banana', voiceUrl: null },
        { word: 'orange', voiceUrl: null }
      ];
      
      // 不再随机排序单词，保持原始顺序
      const originalWords = [...mockWords];
      
      // 初始时设置为暂停状态
      this.setData({
        wordList: originalWords,
        totalWords: originalWords.length,
        currentWord: originalWords[0],
        title: '英语基础词汇',
        startTime: new Date(), // 记录开始时间
        isPlaying: false, // 初始设置为暂停状态
        playCount: 1 // 确保播放次数UI显示为1
      });
      
      console.log('页面加载完成，准备延迟1.5秒后自动播放');
      
      // 延迟1.5秒后开始播放第一个单词
      if (!this.autoPlayScheduled) {
        this.autoPlayScheduled = true; // 标记已安排自动播放
        setTimeout(() => {
          console.log('延迟时间到，现在开始自动播放');
          // 隐藏准备中提示
          wx.hideToast();
          // 设置为播放状态
          this.setData({ isPlaying: true });
          // 直接调用播放函数，绕过按钮逻辑
          this.autoStartPlayback();
        }, 1500);
      }
      
      return;
    }
    
    // 不再随机排序单词，保持原始顺序
    const originalWords = [...wordList];
    
    // 初始时设置为暂停状态
    this.setData({
      wordList: originalWords,
      totalWords: originalWords.length,
      currentWord: originalWords[0],
      title: title,
      startTime: new Date(), // 记录开始时间
      isPlaying: false, // 初始设置为暂停状态
      playCount: 1 // 确保播放次数UI显示为1
    });
    
    console.log('页面加载完成，准备延迟1.5秒后自动播放');
    
    // 延迟1.5秒后开始播放
    if (!this.autoPlayScheduled) {
      this.autoPlayScheduled = true; // 标记已安排自动播放
      setTimeout(() => {
        console.log('延迟时间到，现在开始自动播放');
        // 隐藏准备中提示
        wx.hideToast();
        // 设置为播放状态
        this.setData({ isPlaying: true });
        // 直接调用播放函数，绕过按钮逻辑
        this.autoStartPlayback();
      }, 1500);
    }
  },

  // 用于自动播放的特殊方法，避免与手动播放/暂停逻辑冲突
  autoStartPlayback: function() {
    const { currentWord } = this.data;
    
    if (!currentWord) {
      console.error('没有当前单词数据，无法开始自动播放');
      return;
    }
    
    console.log('开始自动播放单词:', currentWord.word);
    
    // 根据词汇是否有预生成的语音URL决定播放方式
    if (currentWord.voiceUrl) {
      // 使用预生成的语音URL播放
      this.playWordWithVoiceUrl(currentWord.voiceUrl);
    } else {
      console.error('单词没有预生成的语音URL:', currentWord.word);
      wx.showToast({
        title: '该单词没有音频',
        icon: 'none',
        duration: 2000
      });
      
      // 延迟2秒后尝试播放下一个单词
      setTimeout(() => {
        this.autoPlayNext();
      }, 2000);
    }
  },

  // 页面显示时触发
  onShow: function() {
    console.log('页面显示，检查音频状态');
    
    // 检查音频是否因为页面隐藏而暂停
    if (this.innerAudioContext) {
      try {
        // 无法直接获取音频是否暂停的状态，依赖播放事件回调更新状态
        console.log('当前播放状态:', this.data.isPlaying ? '播放中' : '已暂停');
      } catch (err) {
        console.error('检查音频状态失败:', err);
      }
    }
    
    // 如果页面重新显示且是播放状态，则恢复播放
    // 但避免与onLoad中的初始播放冲突
    if (!this.initialPlay && !this.autoPlayScheduled && this.data.isPlaying && this.data.currentWord && this.data.currentWord.voiceUrl) {
      // 短暂延迟确保音频上下文已准备好
      setTimeout(() => {
        this.playWordWithVoiceUrl(this.data.currentWord.voiceUrl);
      }, 300);
    }
  },

  // 播放当前单词
  playWord: function() {
    const { currentWord, isPlaying, currentIndex, totalWords, allWordsCompleted } = this.data;
    
    // 检查是否所有单词都已播放完成
    if (allWordsCompleted && !isPlaying) {
      // 所有单词已播放完成且当前是暂停状态，弹出确认框
      wx.showModal({
        title: '重新开始听写',
        content: '是否重新开始听写？',
        confirmText: '重新开始',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 用户确认重新开始，重置索引到第一个单词
            this.setData({
              currentIndex: 0,
              currentWord: this.data.wordList[0],
              isPlaying: true,
              playCount: 1,
              allWordsCompleted: false // 重置标记
            });
            
            // 开始播放第一个单词
            if (this.data.wordList[0].voiceUrl) {
              this.playWordWithVoiceUrl(this.data.wordList[0].voiceUrl);
            } else {
              wx.showToast({
                title: '该单词没有音频',
                icon: 'none'
              });
            }
          }
        }
      });
      return;
    }
    
    // 用户点击播放/暂停按钮的逻辑
    if (isPlaying) {
      // 如果正在播放，则暂停
      console.log('用户点击暂停按钮，暂停播放');
      this.stopAudioPlay();
      this.setData({ isPlaying: false });
      return;
    } else {
      // 如果已暂停，则恢复播放
      console.log('用户点击播放按钮，恢复播放');
      this.setData({ isPlaying: true });
    }
    
    if (!currentWord) {
      console.error('没有当前单词数据');
      this.setData({ isPlaying: false });
      return;
    }
    
    console.log('开始播放单词:', currentWord.word);
    
    // 根据词汇是否有预生成的语音URL决定播放方式
    if (currentWord.voiceUrl) {
      // 使用预生成的语音URL播放
      this.playWordWithVoiceUrl(currentWord.voiceUrl);
    } else {
      console.error('单词没有预生成的语音URL:', currentWord.word);
      wx.showToast({
        title: '该单词没有音频',
        icon: 'none',
        duration: 2000
      });
      
      // 延迟2秒后尝试播放下一个单词
      setTimeout(() => {
        this.autoPlayNext();
      }, 2000);
    }
  },
  
  // 停止音频播放
  stopAudioPlay: function() {
    console.log('停止音频播放');
    
    // 清除定时器
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    
    // 停止音频播放
    if (this.innerAudioContext) {
      // 停止播放
      try {
        this.innerAudioContext.stop();
      } catch (err) {
        console.error('停止音频播放失败:', err);
      }
    }
    
    // 重置播放次数
    this.playCount = 1;
    this.setData({
      playCount: 1
    });
  },
  
  // 使用合成的语音URL播放单词
  playWordWithVoiceUrl: function(voiceUrl) {
    // 重置播放次数计数，默认从1开始
    this.playCount = 1;
    
    // 更新UI显示的播放次数
    this.setData({
      playCount: 1  // 默认从1开始，即第一个点高亮
    });
    
    // 清除可能存在的定时器
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    
    // 确保先销毁可能存在的旧音频实例
    if (this.innerAudioContext) {
      try {
        // 先停止当前可能正在播放的音频
        this.innerAudioContext.stop();
        // 移除事件监听
        this.innerAudioContext.offEnded();
        this.innerAudioContext.offError();
        this.innerAudioContext.offStop();
        this.innerAudioContext.offPause();
        this.innerAudioContext.offPlay();
        // 销毁实例
        this.innerAudioContext.destroy();
      } catch (err) {
        console.error('销毁音频实例失败:', err);
      }
      this.innerAudioContext = null;
    }
    
    // 创建新的音频上下文
    this.innerAudioContext = wx.createInnerAudioContext();
    console.log('创建新的音频实例，准备播放音频:', voiceUrl);
    
    try {
      // 检查文件是否存在
      const fs = wx.getFileSystemManager();
      fs.access({
        path: voiceUrl,
        success: () => {
          console.log('音频文件存在:', voiceUrl);
          
          // 设置音频源
          this.innerAudioContext.src = voiceUrl;
          
          // 创建播放函数，用于递归播放
          const playNextRepetition = () => {
            // 已播放一次，增加计数
            this.playCount++;
            console.log(`播放次数: ${this.playCount-1}/3 完成`);
            
            // 更新UI显示的播放次数
            this.setData({
              playCount: this.playCount
            });
            
            // 如果播放次数小于等于3，则等待300ms后再次播放同一个单词
            if (this.playCount <= 3) {
              console.log(`等待300ms后开始播放第${this.playCount}次`);
              
              // 清除可能存在的之前的定时器
              if (this.playTimer) {
                clearTimeout(this.playTimer);
              }
              
              // 延迟300ms后再次播放
              this.playTimer = setTimeout(() => {
                if (this.data.isPlaying) { // 确保用户没有暂停
                  console.log(`开始播放第${this.playCount}次`);
                  this.innerAudioContext.play();
                }
              }, 300); // 设置300ms的停顿时间
            } else {
              // 播放完3次后重置计数 UI 不重置
              console.log('已完成3次播放，准备播放下一个单词');
              
              // 在1秒后自动播放下一个单词
              console.log('等待1秒后播放下一个单词');
              
              // 清除可能存在的之前的定时器
              if (this.playTimer) {
                clearTimeout(this.playTimer);
              }
              
              this.playTimer = setTimeout(() => {
                if (this.data.isPlaying) { // 确保用户没有暂停
                  // 移动到下一个单词前重置播放次数 UI
                  this.playCount = 1;
                  this.setData({
                    playCount: 1  // 默认从1开始
                  });
                  console.log('开始播放下一个单词');
                  this.autoPlayNext();
                }
              }, 1000); // 保持单词间1秒的停顿时间
            }
          };
          
          // 设置播放结束事件处理
          this.innerAudioContext.onEnded(playNextRepetition);
          
          // 监听播放暂停事件（当小程序进入后台或锁屏时可能触发）
          this.innerAudioContext.onPause(() => {
            console.log('音频播放被暂停');
            // 更新UI状态为暂停
            this.setData({ isPlaying: false });
          });
          
          // 监听播放停止事件
          this.innerAudioContext.onStop(() => {
            console.log('音频播放被停止');
            // 更新UI状态为暂停
            this.setData({ isPlaying: false });
          });
          
          // 监听播放开始/恢复事件
          this.innerAudioContext.onPlay(() => {
            console.log('音频播放开始/恢复');
            // 确保UI状态为播放中
            this.setData({ isPlaying: true });
          });
          
          this.innerAudioContext.onError((err) => {
            console.error('播放语音失败:', err);
            wx.showToast({
              title: '播放失败',
              icon: 'none'
            });
            // 出错时重置播放状态
            this.playCount = 1;
            this.setData({ 
              isPlaying: false,
              playCount: 1
            });
            
            // 尝试播放下一个单词
            setTimeout(() => {
              this.autoPlayNext();
            }, 2000);
          });
          
          // 自动开始播放
          this.innerAudioContext.play();
        },
        fail: (err) => {
          console.error('音频文件不存在:', err);
          wx.showToast({
            title: '音频文件不存在',
            icon: 'none'
          });
          
          // 出错时重置播放状态
          this.playCount = 1;
          this.setData({ 
            isPlaying: false,
            playCount: 1
          });
          
          // 尝试播放下一个单词
          setTimeout(() => {
            this.autoPlayNext();
          }, 2000);
        }
      });
    } catch (error) {
      console.error('播放异常:', error);
      wx.showToast({
        title: '播放出错: ' + error.message,
        icon: 'none'
      });
      
      // 出错时重置播放状态
      this.playCount = 1;
      this.setData({ 
        isPlaying: false,
        playCount: 1
      });
      
      // 尝试播放下一个单词
      setTimeout(() => {
        this.autoPlayNext();
      }, 2000);
    }
  },

  // 自动播放下一个单词
  autoPlayNext: function() {
    console.log('尝试自动播放下一个单词');
    
    // 确保用户未暂停播放
    if (!this.data.isPlaying) {
      console.log('用户已暂停播放，不执行自动播放');
      return;
    }
    
    // 获取当前正在播放的单词索引
    const currentIndex = this.data.currentIndex;
    const words = this.data.wordList || [];
    
    // 检查是否还有下一个单词
    if (currentIndex + 1 < words.length) {
      // 切换到下一个单词
      this.setData({
        currentIndex: currentIndex + 1,
        currentWord: words[currentIndex + 1]
      });
      
      // 获取下一个单词的音频URL
      const nextWord = words[currentIndex + 1];
      if (nextWord && nextWord.voiceUrl) {
        console.log('自动播放下一个单词:', nextWord.word);
        this.playWordWithVoiceUrl(nextWord.voiceUrl);
      } else {
        console.error('下一个单词没有音频URL:', nextWord);
        wx.showToast({
          title: '该单词没有音频',
          icon: 'none'
        });
        
        // 如果还有更多单词，尝试再下一个
        if (currentIndex + 2 < words.length) {
          setTimeout(() => {
            this.setData({
              currentIndex: currentIndex + 2,
              currentWord: words[currentIndex + 2]
            });
            this.autoPlayNext();
          }, 1000);
        } else {
          // 已经到达最后一个单词
          this.setData({
            isPlaying: false,
            allWordsCompleted: true // 添加标记，表示所有单词已播放完成
          });
          wx.showToast({
            title: '所有单词已播放完',
            icon: 'success'
          });
          
          // 延迟后完成听写
          setTimeout(() => {
            this.finishDictation();
          }, 2000);
        }
      }
    } else {
      // 已经是最后一个单词
      this.setData({
        isPlaying: false,
        allWordsCompleted: true // 添加标记，表示所有单词已播放完成
      });
      wx.showToast({
        title: '所有单词已播放完',
        icon: 'success'
      });
      
      // 延迟后完成听写
      setTimeout(() => {
        this.finishDictation();
      }, 2000);
    }
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
    this.stopAudioPlay();
    
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
    this.stopAudioPlay();
    
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
  endDictation: function() {
    wx.showModal({
      title: '结束听写',
      content: '确定要结束当前听写吗？',
      success: res => {
        if (res.confirm) {
          // 调用完成听写函数，传入参数表示跳过提示音
          this.finishDictation(true);
        }
      }
    });
  },
  
  // 完成听写
  finishDictation: function(skipPrompts) {
    console.log('完成听写', skipPrompts ? '(静默模式)' : '');
    
    // 防止重复调用
    if (this.isFinishing) {
      console.log('已经在处理完成流程中，忽略重复调用');
      return;
    }
    
    // 标记正在完成中
    this.isFinishing = true;
    
    // 停止音频播放
    this.stopAudioPlay();
    
    // 如果是手动结束（skipPrompts为true），则销毁音频
    if (skipPrompts) {
      this.destroyAllAudio();
    }
    
    // 获取单词列表
    const wordList = this.data.wordList || [];
    
    // 只有在非静默模式下才显示Toast提示
    if (!skipPrompts) {
      // 提示用户听写已完成
      wx.showToast({
        title: '听写已完成',
        icon: 'success'
      });
    }
    
    // 准备要保存的记录数据
    const recordData = {
      title: this.data.title || '未命名听写',
      date: new Date().getTime(),
      words: wordList.map(item => {
        return {
          word: item.word,
          userInput: '', // 不记录用户输入
          correct: false // 不判断正确性
        };
      }),
      totalWords: wordList.length,
      correctCount: 0, // 不记录正确数量
      serial: Date.now().toString() // 添加序列号到这里，避免多次生成
    };
    
    console.log('准备保存听写记录:', recordData);
    
    // 保存听写记录到本地存储
    try {
      // 获取现有记录
      const records = wx.getStorageSync('dictationRecords') || [];
      
      // 添加新记录到记录列表最前面
      records.unshift(recordData);
      
      // 保存回本地存储
      wx.setStorageSync('dictationRecords', records);
      
      // 同时保存当前听写记录作为最新记录
      wx.setStorageSync('currentDictationRecord', recordData);
      
      console.log('听写记录已保存');
      
      // 清理临时音频文件
      this.cleanupTempAudioFiles();
      
      // 如果是手动结束（skipPrompts为true），则直接跳转
      if (skipPrompts) {
        this.navigateToCompletePage();
        return;
      }
      
      // 如果已经在播放提示音，不重复播放
      if (this.isPlayingCompletionAudio) {
        console.log('提示音正在播放中，不重复播放');
        return;
      }
      
      // 标记正在播放提示音
      this.isPlayingCompletionAudio = true;
      
      // 播放完成提示音
      this.playCompletionAudio(() => {
        // 播放完成后重置标记
        this.isPlayingCompletionAudio = false;
        
        // 跳转到核对页面
        this.navigateToCompletePage();
      });
      
    } catch (error) {
      console.error('保存听写记录失败:', error);
      wx.showModal({
        title: '错误',
        content: '保存听写记录失败，请重试',
        showCancel: false
      });
      // 重置完成标记
      this.isFinishing = false;
    }
  },

  // 导航到完成页面
  navigateToCompletePage: function() {
    wx.navigateTo({
      url: '/pages/dictation-complete/index',
      success: () => {
        console.log('成功跳转到核对听写页面');
        // 跳转成功后重置标记
        this.isFinishing = false;
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        // 跳转失败时也重置标记
        this.isFinishing = false;
      }
    });
  },

  // 组件销毁时清理资源
  onUnload: function() {
    console.log('页面卸载，清理资源');
    
    // 清除定时器
    if (this.playTimer) {
      clearTimeout(this.playTimer);
      this.playTimer = null;
    }
    
    // 销毁音频实例
    if (this.innerAudioContext) {
      try {
        this.innerAudioContext.stop();
        this.innerAudioContext.destroy();
      } catch (err) {
        console.error('销毁音频实例失败:', err);
      }
    }
    
    // 销毁完成提示音实例
    if (this.completionAudioContext) {
      try {
        this.completionAudioContext.stop();
        this.completionAudioContext.destroy();
      } catch (err) {
        console.error('销毁完成提示音实例失败:', err);
      }
    }
    
    // 关闭屏幕常亮
    wx.setKeepScreenOn({
      keepScreenOn: false
    });
  },

  // 清理临时音频文件
  cleanupTempAudioFiles: function() {
    console.log('清理临时音频文件');
    // 获取所有生成的音频文件
    const savedAudioFiles = wx.getStorageSync('saved_audio_files') || {};
    
    // 当前保留的音频文件
    const keepFiles = new Set(['completion_audio.mp3']);
    
    // 遍历所有保存的音频文件
    Object.keys(savedAudioFiles).forEach(fileName => {
      // 如果不在保留列表中，则删除
      if (!keepFiles.has(fileName)) {
        const filePath = savedAudioFiles[fileName].path;
        
        try {
          // 删除文件
          const fs = wx.getFileSystemManager();
          fs.unlink({
            filePath: filePath,
            success: () => {
              console.log('成功删除临时音频文件:', filePath);
            },
            fail: (err) => {
              console.error('删除临时音频文件失败:', err);
            }
          });
        } catch (error) {
          console.error('删除文件操作失败:', error);
        }
      }
    });
    
    // 更新存储，只保留需要的文件
    const updatedSavedFiles = {};
    keepFiles.forEach(fileName => {
      if (savedAudioFiles[fileName]) {
        updatedSavedFiles[fileName] = savedAudioFiles[fileName];
      }
    });
    
    // 更新存储
    wx.setStorageSync('saved_audio_files', updatedSavedFiles);
  },
  
  // 随机排序数组
  shuffleArray: function (array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },
  
  // 判断答案是否正确
  isAnswerCorrect: function(word, answer) {
    if (!word || !answer) return false;
    
    // 将单词和答案都转为小写，并去除前后空格进行比较
    const formattedWord = word.toLowerCase().trim();
    const formattedAnswer = answer.toLowerCase().trim();
    
    return formattedWord === formattedAnswer;
  },

  // 检查完成提示音是否存在，没有则生成
  checkCompletionAudio: function() {
    const completionAudioPath = `${wx.env.USER_DATA_PATH}/completion_audio.mp3`;
    const fs = wx.getFileSystemManager();
    
    try {
      // 检查文件是否存在
      fs.accessSync(completionAudioPath);
      console.log('完成提示音已存在');
      // 将路径保存到数据中，方便后续使用
      this.completionAudioPath = completionAudioPath;
    } catch (error) {
      console.log('完成提示音不存在，开始生成...');
      this.generateCompletionAudio();
    }
  },
  
  // 生成完成提示音
  generateCompletionAudio: function() {
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
        "Text": "听写已完成，请上传听写结果。",
        "SessionId": `session-${Date.now()}`,
        // "Volume": 2,
        "Speed": 1,
        "ProjectId": 0,
        "ModelType": 1,
        "VoiceType": 501001, // 中文发音
        "PrimaryLanguage": 1, // 中文
        "SampleRate": 16000,
        "Codec": "mp3",
        "EmotionCategory": "neutral",
        "EmotionIntensity": 100
      }
    }).then(response => {
      if (response.statusCode === 200 && response.data.code === 0 && response.data.data.Audio) {
        // 获取音频Base64数据
        const audioBase64 = response.data.data.Audio;
        
        // 将Base64转换为永久文件
        this.base64ToFile(audioBase64, "completion_audio.mp3").then(filePath => {
          console.log('完成提示音生成成功:', filePath);
          this.completionAudioPath = filePath;
        }).catch(error => {
          console.error('完成提示音文件保存失败:', error);
        });
      } else {
        console.error('完成提示音生成接口返回错误:', response);
      }
    }).catch(error => {
      console.error('完成提示音生成请求失败:', error);
    });
  },

  // Base64转永久文件
  base64ToFile: function(base64Data, fileName) {
    return new Promise((resolve, reject) => {
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
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
          savedAudioFiles[fileName] = {
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

  /**
   * 返回按钮点击处理
   */
  onBackClick() {
      wx.showModal({
      title: '确认退出',
      content: '确定要退出听写吗？当前进度将不会保存。',
      confirmText: '退出',
      confirmColor: '#FF6B6B',
      cancelText: '继续听写',
        success: (res) => {
          if (res.confirm) {
          // 停止音频播放
          if (this.innerAudioContext) {
            try {
              this.innerAudioContext.stop();
            } catch (e) {
              console.error('停止音频播放失败:', e);
            }
          }
          
          // 返回上一页
          wx.navigateBack();
        }
      }
    });
  },
  
  /**
   * 确认结束听写
   */
  confirmExit() {
    wx.showModal({
      title: '确认完成',
      content: '确定完成听写吗？将无法再继续听写本次内容。',
      confirmText: '完成',
      confirmColor: '#4CAF50',
      cancelText: '继续听写',
      success: (res) => {
        if (res.confirm) {
          // 彻底停止并销毁所有音频
          this.destroyAllAudio();
          
          // 传递true参数，表示跳过提示音和toast
          this.finishDictation(true);
        }
      }
    });
  },

  // 页面隐藏时触发
  onHide: function() {
    console.log('页面隐藏');
    
    // 当页面隐藏时（如最小化或切换到其他小程序页面），检查播放状态
    if (this.data.isPlaying) {
      console.log('页面隐藏时正在播放，标记UI为暂停状态');
      // 更新UI为暂停状态，但不主动停止音频
      // 音频可能会自动暂停，我们依赖onPause事件来处理
      this.setData({ 
        isPlaying: false 
      });
    }
  },

  // 分享给朋友
  onShareAppMessage: function() {
    return app.shareAppMessage();
  },
  
  // 分享到朋友圈
  onShareTimeline: function() {
    return app.shareTimeline();
  },

  // 彻底停止并销毁所有音频
  destroyAllAudio: function() {
    console.log('彻底停止并销毁所有音频实例');
    
    // 停止并销毁主音频实例
    if (this.innerAudioContext) {
      try {
        this.innerAudioContext.stop();
        this.innerAudioContext.offEnded();
        this.innerAudioContext.offError();
        this.innerAudioContext.offStop();
        this.innerAudioContext.offPause();
        this.innerAudioContext.offPlay();
        this.innerAudioContext.destroy();
        this.innerAudioContext = null;
      } catch (err) {
        console.error('销毁音频实例失败:', err);
      }
    }
    
    // 停止并销毁完成提示音实例
    if (this.completionAudioContext) {
      try {
        this.completionAudioContext.stop();
        this.completionAudioContext.offEnded();
        this.completionAudioContext.offError();
        this.completionAudioContext.offStop();
        this.completionAudioContext.offPause();
        this.completionAudioContext.offPlay();
        this.completionAudioContext.destroy();
        this.completionAudioContext = null;
      } catch (err) {
        console.error('销毁完成提示音实例失败:', err);
      }
    }
    
    // 重置音频播放标记
    this.isPlayingCompletionAudio = false;
  },

  // 播放完成提示音
  playCompletionAudio: function(callback) {
    const completionAudioPath = `${wx.env.USER_DATA_PATH}/completion_audio.mp3`;
    
    console.log('尝试播放完成提示音:', completionAudioPath);
    
    // 检查文件是否存在
    const fs = wx.getFileSystemManager();
    fs.access({
      path: completionAudioPath,
      success: () => {
        console.log('完成提示音文件存在，开始播放');
        
        // 重置播放计数
        this.completionPlayCount = 0;
        
        // 停止当前正在播放的单词音频
        if (this.innerAudioContext) {
          try {
            this.innerAudioContext.stop();
          } catch (err) {
            console.error('停止音频失败:', err);
          }
        }
        
        // 创建音频上下文
        if (this.completionAudioContext) {
          try {
            this.completionAudioContext.stop();
            this.completionAudioContext.offEnded();
            this.completionAudioContext.offError();
            this.completionAudioContext.offPause();
            this.completionAudioContext.offStop();
            this.completionAudioContext.destroy();
          } catch (err) {
            console.error('销毁旧的完成提示音上下文失败:', err);
          }
        }
        
        this.completionAudioContext = wx.createInnerAudioContext();
        this.completionAudioContext.src = completionAudioPath;
        
        // 播放完成事件
        this.completionAudioContext.onEnded(() => {
          console.log('完成提示音播放结束');
          this.completionPlayCount++;
          
          // 最多播放3次
          if (this.completionPlayCount < 3) {
            console.log(`开始第${this.completionPlayCount + 1}次播放完成提示音`);
            this.completionAudioContext.play();
          } else {
            console.log('完成提示音已播放3次，停止播放');
            // 播放完3次后执行回调
            if (typeof callback === 'function') {
              console.log('执行完成提示音播放结束回调');
              callback();
            }
          }
        });
        
        // 监听暂停事件
        this.completionAudioContext.onPause(() => {
          console.log('完成提示音被暂停');
        });
        
        // 监听停止事件
        this.completionAudioContext.onStop(() => {
          console.log('完成提示音被停止');
          // 如果音频被手动停止，也应该调用回调
          if (typeof callback === 'function') {
            console.log('完成提示音被停止，执行回调');
            callback();
          }
        });
        
        // 播放错误处理
        this.completionAudioContext.onError((err) => {
          console.error('播放完成提示音失败:', err);
          // 出错时也调用回调，确保能继续后续操作
          if (typeof callback === 'function') {
            console.log('完成提示音播放出错，执行回调');
            callback();
          }
        });
        
        // 开始播放
        this.completionAudioContext.play();
      },
      fail: (err) => {
        console.error('完成提示音文件不存在:', err);
        // 如果文件不存在，直接调用回调
        if (typeof callback === 'function') {
          console.log('完成提示音文件不存在，直接执行回调');
          callback();
        }
      }
    });
  },
}) 