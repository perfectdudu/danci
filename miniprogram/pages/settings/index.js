const app = getApp();

Page({
  data: {
    speedOptions: ['0.8x', '1.0x', '1.2x', '1.5x'],
    speedIndex: 1, // 默认1.0x
    
    intervalOptions: ['3秒', '5秒', '8秒', '10秒'],
    intervalIndex: 1, // 默认5秒
    
    pronTypeOptions: ['美式发音', '英式发音'],
    pronTypeIndex: 0, // 默认美式发音
    
    volumeOptions: ['低', '中', '高'],
    volumeIndex: 2, // 默认高音量
    
    playSettings: {
      speed: 1.0,
      interval: 5,
      autoPlay: true
    },
    
    pronunciationSettings: {
      type: 'us', // 美式发音
      volume: 'high'
    },
    
    otherSettings: {
      showPhonetic: true,
      collectMistakes: true,
      darkMode: false
    }
  },

  onLoad: function () {
    // 从全局配置中加载设置
    this.loadSettings();
  },

  // 从全局配置加载设置
  loadSettings: function () {
    const { playSettings, pronunciationSettings, otherSettings } = app.globalData;
    
    // 找到speed对应的索引
    let speedIndex = 1; // 默认1.0x
    if (playSettings.speed === 0.8) speedIndex = 0;
    else if (playSettings.speed === 1.2) speedIndex = 2;
    else if (playSettings.speed === 1.5) speedIndex = 3;
    
    // 找到interval对应的索引
    let intervalIndex = 1; // 默认5秒
    if (playSettings.interval === 3) intervalIndex = 0;
    else if (playSettings.interval === 8) intervalIndex = 2;
    else if (playSettings.interval === 10) intervalIndex = 3;
    
    // 找到type对应的索引
    const pronTypeIndex = pronunciationSettings.type === 'us' ? 0 : 1;
    
    // 找到volume对应的索引
    let volumeIndex = 2; // 默认高音量
    if (pronunciationSettings.volume === 'low') volumeIndex = 0;
    else if (pronunciationSettings.volume === 'medium') volumeIndex = 1;
    
    this.setData({
      speedIndex,
      intervalIndex,
      pronTypeIndex,
      volumeIndex,
      playSettings,
      pronunciationSettings,
      otherSettings
    });
  },

  // 保存设置到全局配置并更新云数据库
  saveSettings: function () {
    // 更新全局配置
    app.globalData.playSettings = this.data.playSettings;
    app.globalData.pronunciationSettings = this.data.pronunciationSettings;
    app.globalData.otherSettings = this.data.otherSettings;
    
    // 如果用户已登录，则保存到云数据库
    if (app.globalData.userInfo) {
      const db = wx.cloud.database();
      db.collection('userSettings').where({
        _openid: app.globalData.userInfo.openId
      }).get().then(res => {
        if (res.data.length > 0) {
          // 更新现有设置
          db.collection('userSettings').doc(res.data[0]._id).update({
            data: {
              playSettings: this.data.playSettings,
              pronunciationSettings: this.data.pronunciationSettings,
              otherSettings: this.data.otherSettings,
              updateTime: new Date()
            }
          });
        } else {
          // 创建新的设置
          db.collection('userSettings').add({
            data: {
              playSettings: this.data.playSettings,
              pronunciationSettings: this.data.pronunciationSettings,
              otherSettings: this.data.otherSettings,
              createTime: new Date()
            }
          });
        }
      });
    }
    
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 1500
    });
    
    // 延迟返回
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 播放速度变化
  onSpeedChange: function (e) {
    const speedIndex = e.detail.value;
    
    // 根据索引获取对应的速度值
    let speed = 1.0;
    if (speedIndex == 0) speed = 0.8;
    else if (speedIndex == 1) speed = 1.0;
    else if (speedIndex == 2) speed = 1.2;
    else if (speedIndex == 3) speed = 1.5;
    
    this.setData({
      speedIndex,
      'playSettings.speed': speed
    });
  },

  // 播放间隔变化
  onIntervalChange: function (e) {
    const intervalIndex = e.detail.value;
    
    // 根据索引获取对应的间隔值
    let interval = 5;
    if (intervalIndex == 0) interval = 3;
    else if (intervalIndex == 1) interval = 5;
    else if (intervalIndex == 2) interval = 8;
    else if (intervalIndex == 3) interval = 10;
    
    this.setData({
      intervalIndex,
      'playSettings.interval': interval
    });
  },

  // 自动播放变化
  onAutoPlayChange: function (e) {
    this.setData({
      'playSettings.autoPlay': e.detail.value
    });
  },

  // 发音类型变化
  onPronTypeChange: function (e) {
    const pronTypeIndex = e.detail.value;
    
    // 根据索引获取对应的发音类型
    const type = pronTypeIndex == 0 ? 'us' : 'uk';
    
    this.setData({
      pronTypeIndex,
      'pronunciationSettings.type': type
    });
  },

  // 音量变化
  onVolumeChange: function (e) {
    const volumeIndex = e.detail.value;
    
    // 根据索引获取对应的音量级别
    let volume = 'high';
    if (volumeIndex == 0) volume = 'low';
    else if (volumeIndex == 1) volume = 'medium';
    else if (volumeIndex == 2) volume = 'high';
    
    this.setData({
      volumeIndex,
      'pronunciationSettings.volume': volume
    });
  },

  // 显示音标变化
  onShowPhoneticChange: function (e) {
    this.setData({
      'otherSettings.showPhonetic': e.detail.value
    });
  },

  // 自动收集错题变化
  onCollectMistakesChange: function (e) {
    this.setData({
      'otherSettings.collectMistakes': e.detail.value
    });
  },

  // 夜间模式变化
  onDarkModeChange: function (e) {
    this.setData({
      'otherSettings.darkMode': e.detail.value
    });
  }
}) 