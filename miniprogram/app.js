// app.js
App({
  globalData: {
    userInfo: null,
    token: null,
    currentImageUrl: null
  },
  onLaunch: async function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: "prod-5g5ywun6829a4db5",
      });
    }

    try {
      const res = await wx.cloud.callContainer({
        "config": {
          "env": "prod-5g5ywun6829a4db5"
        },
        "path": "/user/login",
        "header": {
          "X-WX-SERVICE": "word-dictation",
          "content-type": "application/json",
          "Authorization": "Bearer"
        },
        "method": "POST",
        "data": {
        }
      })
      this.globalData.token = res.data.token
    } catch (err) {
      console.error(err)
    }
  },
  
  // 全局分享给朋友方法
  shareAppMessage: function() {
    return {
      title: "我正在使用kop的AI听写助手，推荐给你！",
      path: '/pages/home/index',
      imageUrl: 'https://hyyg-1255426464.cos.ap-guangzhou.myqcloud.com/nezha.png',
      success: function(res) {
        // 分享成功的回调
        wx.showToast({
          title: '分享成功',
          icon: 'success',
          duration: 1500
        });
      },
      fail: function(res) {
        // 分享失败的回调
        console.error('分享失败:', res);
      }
    };
  },
  
  // 全局分享到朋友圈方法
  shareTimeline: function() {
    return {
      title: "我正在使用kop的AI听写助手，推荐给你！",
      query: "from=timeline",
      imageUrl: 'https://hyyg-1255426464.cos.ap-guangzhou.myqcloud.com/nezha.png',
      success: function(res) {
        // 分享成功的回调
        wx.showToast({
          title: '分享成功',
          icon: 'success',
          duration: 1500
        });
      },
      fail: function(res) {
        // 分享失败的回调
        console.error('分享失败:', res);
      }
    };
  }
});
