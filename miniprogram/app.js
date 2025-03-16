// app.js
App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: "cloud1",
        traceUser: true,
      });
    }

    // 获取胶囊按钮位置信息
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    
    // 获取系统信息
    wx.getSystemInfo({
      success: (res) => {
        // 存储系统信息
        this.globalData.systemInfo = res;
        // 存储胶囊按钮信息
        this.globalData.menuButtonInfo = menuButtonInfo;
        // 计算导航栏高度
        this.globalData.headerHeight = menuButtonInfo.height + (menuButtonInfo.top - res.statusBarHeight) * 2;
        // 状态栏高度
        this.globalData.statusBarHeight = res.statusBarHeight;
      }
    });

    this.globalData = {
      // 系统信息
      systemInfo: null,
      menuButtonInfo: null,
      headerHeight: 0,
      statusBarHeight: 0,
      // 用户信息
      userInfo: null,
      // 单词集合
      wordLists: [],
      // 播放设置
      playSettings: {
        speed: 1.0,
        interval: 5,
        autoPlay: true
      },
      // 发音设置
      pronunciationSettings: {
        type: "us", // 美式发音
        volume: "high"
      },
      // 其他设置
      otherSettings: {
        showPhonetic: true,
        collectMistakes: true,
        darkMode: false
      }
    };
  },
});
