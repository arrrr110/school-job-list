// 支付相关配置
export const PAYMENT_CONFIG = {
  // 支付金额（单位：分）
  AMOUNT: 990, // 9.9元
  
  // 金额显示格式（元）
  get AMOUNT_YUAN() {
    return (this.AMOUNT / 100).toFixed(2);
  },
  
  // 支付描述
  DESCRIPTION: '秋招实习汇总表解锁服务',
  
  // 支付超时时间（秒）
  TIMEOUT: 60,
  
  // 轮询间隔（毫秒）
  POLLING_INTERVAL: 3000,
  
  // 重试间隔（秒）
  RETRY_INTERVAL: 10,
  
  // CloudBase 配置
  CLOUDBASE: {
    ENV: 'cloud1-1gfyi6az06806a08',
    REGION: 'ap-shanghai'
  },
  
  // 云函数名称
  FUNCTIONS: {
    ORDER: 'order',
    QUERY_ORDER: 'query_order'
  }
} as const;

// 导出常用值
export const { AMOUNT, AMOUNT_YUAN, DESCRIPTION } = PAYMENT_CONFIG;