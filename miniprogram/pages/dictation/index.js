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
  },

  onLoad: function (options) {
    // 初始化播放相关参数
    this.playCount = 1;
    this.playTimer = null;
    this.initialPlay = true; // 标记为初始加载
    this.autoPlayScheduled = false; // 标记是否已安排自动播放
    
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
      
      // 随机排序单词
      const shuffledWords = this.shuffleArray([...mockWords]);
      
      // 初始时设置为暂停状态
      this.setData({
        wordList: shuffledWords,
        totalWords: shuffledWords.length,
        currentWord: shuffledWords[0],
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
    
    // 随机排序单词
    const shuffledWords = this.shuffleArray([...wordList]);
    
    // 初始时设置为暂停状态
    this.setData({
      wordList: shuffledWords,
      totalWords: shuffledWords.length,
      currentWord: shuffledWords[0],
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
    console.log('页面显示，检查是否需要播放');
    
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
    const { currentWord, isPlaying } = this.data;
    
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
      // 移除事件监听
      this.innerAudioContext.offEnded();
      this.innerAudioContext.offError();
      // 停止播放
      this.innerAudioContext.stop();
      // 销毁实例
      this.innerAudioContext.destroy();
      this.innerAudioContext = null;
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
      // 先停止当前可能正在播放的音频
      try {
        this.innerAudioContext.stop();
        // 移除事件监听
        this.innerAudioContext.offEnded();
        this.innerAudioContext.offError();
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
            
            // 如果播放次数小于等于3，则等待1秒后再次播放同一个单词
            if (this.playCount <= 3) {
              console.log(`等待1秒后开始播放第${this.playCount}次`);
              
              // 清除可能存在的之前的定时器
              if (this.playTimer) {
                clearTimeout(this.playTimer);
              }
              
              // 延迟1秒后再次播放
              this.playTimer = setTimeout(() => {
                if (this.data.isPlaying) { // 确保用户没有暂停
                  console.log(`开始播放第${this.playCount}次`);
                  this.innerAudioContext.play();
                }
              }, 1000); // 设置1秒的停顿时间
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
              }, 1000);
            }
          };
          
          // 设置播放结束事件处理
          this.innerAudioContext.onEnded(playNextRepetition);
          
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
          
          // 开始播放
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
            isPlaying: false
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
        isPlaying: false
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
          // 跳转到听写完成页面
          wx.navigateTo({
            url: '/pages/dictation-complete/index'
          });
        }
      }
    });
  },
  
  // 完成听写
  finishDictation: function(skipPrompts) {
    console.log('完成听写', skipPrompts ? '(静默模式)' : '');
    
    // 停止音频播放
    this.stopAudioPlay();
    
    // 获取用户输入的答案
    const userAnswers = {};
    const wordList = this.data.wordList || [];
    
    // 遍历所有单词，收集用户的答案
    wordList.forEach((item, index) => {
      const inputValue = this.data.answers[index] || '';
      userAnswers[item.word] = {
        word: item.word,
        userInput: inputValue,
        correct: this.isAnswerCorrect(item.word, inputValue)
      };
    });
    
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
      words: wordList.map((item, index) => {
        return {
          word: item.word,
          userInput: this.data.answers[index] || '',
          correct: this.isAnswerCorrect(item.word, this.data.answers[index] || '')
        };
      }),
      totalWords: wordList.length,
      correctCount: Object.values(userAnswers).filter(item => item.correct).length,
      serial: Date.now().toString() // 添加序列号到这里，避免多次生成
    };
    
    console.log('准备保存听写记录:', recordData);
    
    // 保存听写记录到本地存储
    try {
      // 获取现有记录
      const records = wx.getStorageSync('dictationRecords') || [];
      
      // 添加新记录并生成唯一标识
      records.unshift(recordData);
      
      // 保存回本地存储
      wx.setStorageSync('dictationRecords', records);
      
      console.log('听写记录已保存');
      
      // 清理临时音频文件
      this.cleanupTempAudioFiles();
      
      // 如果已经在播放提示音，则不再重复播放
      if (this.isPlayingCompletionAudio) {
        console.log('提示音正在播放中，不重复播放');
        return;
      }
      
      // 如果是静默模式，直接跳转到核对页面，不播放提示音
      if (skipPrompts) {
        // 直接跳转到核对页面
        wx.navigateTo({
          url: `/pages/dictation-complete/index?serial=${recordData.serial}`,
          success: () => {
            console.log('成功跳转到核对听写页面');
          },
          fail: (err) => {
            console.error('跳转失败:', err);
          }
        });
        return;
      }
      
      // 标记正在播放提示音
      this.isPlayingCompletionAudio = true;
      
      // 播放完成提示音
      this.playCompletionAudio(() => {
        // 播放完成后重置标记
        this.isPlayingCompletionAudio = false;
        
        // 跳转到核对页面
        wx.navigateTo({
          url: `/pages/dictation-complete/index?serial=${recordData.serial}`,
          success: () => {
            console.log('成功跳转到核对听写页面');
          },
          fail: (err) => {
            console.error('跳转失败:', err);
          }
        });
      });
    } catch (error) {
      console.error('保存听写记录失败:', error);
      wx.showModal({
        title: '错误',
        content: '保存听写记录失败，请重试',
        showCancel: false
      });
    }
  },

  // 播放完成提示音
  playCompletionAudio: function(callback) {
    console.log('准备播放完成提示音');
    
    if (!this.completionAudioPath) {
      console.error('完成提示音未生成');
      if (callback) callback();
      return;
    }
    
    // 确保停止所有其他音频播放
    this.stopAudioPlay();
    
    // 重置播放计数
    this.completionPlayCount = 0;
    
    // 创建新的音频上下文（与单词播放分开）
    try {
      if (this.completionAudioContext) {
        try {
          this.completionAudioContext.destroy();
        } catch (e) {
          console.error('销毁旧的完成提示音上下文失败:', e);
        }
      }
      
      const completionAudio = wx.createInnerAudioContext();
      this.completionAudioContext = completionAudio;
      
      completionAudio.src = this.completionAudioPath;
      
      // 播放函数
      const playCompletionRepetition = () => {
        this.completionPlayCount++;
        console.log(`完成提示音播放次数: ${this.completionPlayCount}/3`);
        
        if (this.completionPlayCount < 3) {
          // 还未播放3次，等待一段时间后继续播放
          setTimeout(() => {
            try {
              completionAudio.play();
            } catch (err) {
              console.error('重复播放完成提示音失败:', err);
              // 出错时直接调用回调
              completionAudio.destroy();
              if (callback) callback();
            }
          }, 500);
        } else {
          console.log('完成提示音播放3次完毕');
          // 确保销毁音频实例，避免重复播放
          try {
            completionAudio.destroy();
          } catch (e) {
            console.error('销毁完成提示音上下文失败:', e);
          }
          this.completionAudioContext = null;
          if (callback) callback();
        }
      };
      
      // 监听播放结束事件
      completionAudio.onEnded(playCompletionRepetition);
      
      // 监听错误事件
      completionAudio.onError((err) => {
        console.error('完成提示音播放出错:', err);
        try {
          completionAudio.destroy();
        } catch (e) {
          console.error('销毁错误的完成提示音上下文失败:', e);
        }
        this.completionAudioContext = null;
        if (callback) callback();
      });
      
      // 确保音频准备好后再播放第一次
      completionAudio.onCanplay(() => {
        // 等待一段时间再开始播放
        setTimeout(() => {
          try {
            // 开始播放
            completionAudio.play();
          } catch (err) {
            console.error('播放完成提示音失败:', err);
            try {
              completionAudio.destroy();
            } catch (e) {
              console.error('销毁失败的完成提示音上下文失败:', e);
            }
            this.completionAudioContext = null;
            if (callback) callback();
          }
        }, 200);
      });
    } catch (error) {
      console.error('创建完成提示音上下文失败:', error);
      if (callback) callback();
    }
  },

  // 组件销毁时清理资源
  onUnload: function() {
    // 停止音频播放
    this.stopAudioPlay();
    
    // 释放音频资源
    if (this.innerAudioContext) {
      try {
        this.innerAudioContext.destroy();
      } catch (e) {
        console.error('销毁innerAudioContext失败:', e);
      }
      this.innerAudioContext = null;
    }
    
    // 释放完成提示音资源
    if (this.completionAudioContext) {
      try {
        this.completionAudioContext.destroy();
      } catch (e) {
        console.error('销毁completionAudioContext失败:', e);
      }
      this.completionAudioContext = null;
    }
    
    // 清理临时音频文件
    this.cleanupTempAudioFiles();
  },

  // 清理临时音频文件
  cleanupTempAudioFiles: function() {
    const wordList = this.data.wordList || [];
    const fs = wx.getFileSystemManager();
    
    // 遍历单词列表，删除所有临时音频文件
    wordList.forEach(item => {
      if (item.voiceUrl) {
        try {
          fs.access({
            path: item.voiceUrl,
            success: () => {
              // 文件存在，尝试删除
              fs.unlink({
                filePath: item.voiceUrl,
                success: () => {
                  console.log('成功删除临时音频文件:', item.voiceUrl);
                },
                fail: (err) => {
                  console.error('删除临时音频文件失败:', err);
                }
              });
            },
            fail: () => {
              // 文件不存在，忽略
              console.log('临时音频文件不存在:', item.voiceUrl);
            }
          });
        } catch (error) {
          console.error('清理临时音频文件出错:', error);
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
        "Text": "听写已完成，请上传听写结果",
        "SessionId": `session-${Date.now()}`,
        "Volume": 1,
        "Speed": 0.9,
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
          // 传递true参数，表示跳过提示音和toast
          this.finishDictation(true);
        }
      }
    });
  },
}) 