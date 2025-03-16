Component({
  properties: {
    title: {
      type: String,
      value: '页面标题'
    },
    showBack: {
      type: Boolean,
      value: true
    },
    backUrl: {
      type: String,
      value: ''
    },
    backDelta: {
      type: Number,
      value: 1
    },
    backMode: {
      type: String,
      value: 'navigateBack' // 可选值：navigateBack, switchTab, reLaunch, redirect
    },
    customBack: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    menuButtonTop: 0,
    menuButtonHeight: 0,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    headerHeight: 0
  },

  lifetimes: {
    attached() {
      const app = getApp();
      // 获取胶囊按钮信息
      const menuButtonInfo = app.globalData.menuButtonInfo || wx.getMenuButtonBoundingClientRect();
      
      // 获取系统信息
      wx.getSystemInfo({
        success: (res) => {
          // 状态栏高度
          const statusBarHeight = res.statusBarHeight;
          // 安全区域
          const safeArea = res.safeArea || {};
          // 计算头部所需高度
          const headerHeight = menuButtonInfo.height + (menuButtonInfo.top - statusBarHeight) * 2 + statusBarHeight;
          
          this.setData({
            statusBarHeight: statusBarHeight,
            menuButtonTop: menuButtonInfo.top,
            menuButtonHeight: menuButtonInfo.height,
            safeAreaTop: safeArea.top || 0,
            safeAreaBottom: res.screenHeight - (safeArea.bottom || res.screenHeight),
            headerHeight: headerHeight
          });
          
          // 触发头部高度事件，通知页面
          this.triggerEvent('heightChange', { height: headerHeight });
        }
      });
    }
  },

  methods: {
    // 返回上一页
    navigateBack() {
      if (this.data.customBack) {
        // 触发自定义返回事件
        this.triggerEvent('back');
        return;
      }

      // 根据不同的返回模式处理
      if (this.data.backMode === 'navigateBack') {
        wx.navigateBack({
          delta: this.data.backDelta
        });
      } else if (this.data.backMode === 'switchTab') {
        wx.switchTab({
          url: this.data.backUrl
        });
      } else if (this.data.backMode === 'reLaunch') {
        wx.reLaunch({
          url: this.data.backUrl
        });
      } else if (this.data.backMode === 'redirect') {
        wx.redirectTo({
          url: this.data.backUrl
        });
      }
    }
  }
}) 