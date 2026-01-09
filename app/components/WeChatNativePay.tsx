import cloudbase from '@cloudbase/js-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface WeChatNativePayProps {
  visible: boolean;
  amount: number; // 支付金额（单位：分）
  onSuccess: () => void;
  onFailure?: (error: string) => void;
  onClose: () => void;
}

// CloudBase应用（动态初始化以避免SSR问题）
let app: any = null;

const getApp = () => {
  if (!app && typeof window !== 'undefined') {
    app = cloudbase.init({
      env: 'cloud1-1gfyi6az06806a08',
      region: 'ap-shanghai'
    });
  }
  return app;
};

const WeChatNativePay: React.FC<WeChatNativePayProps> = ({
  visible,
  amount = 100, // 默认100分（1元）
  onSuccess,
  onFailure,
  onClose,
}) => {
  const [paymentStep, setPaymentStep] = useState<'qr' | 'processing' | 'success' | 'error'>('qr');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [countdown, setCountdown] = useState(60); // 60秒倒计时

  useEffect(() => {
    if (visible) {
      generatePaymentQR();
    }
  }, [visible]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      handlePaymentError('支付超时，请重新生成二维码');
    }
  }, [countdown]);

  // 生成支付二维码（调用云函数实现微信支付统一下单）
  const generatePaymentQR = async () => {
    try {
      setPaymentStep('qr');
      setCountdown(60);
      // 调用云函数实现微信支付统一下单
      const cloudbaseApp = getApp();

      if (!cloudbaseApp) {
        throw new Error('CloudBase环境未初始化');
      }else {
        console.log('CloudBase环境已初始化')
              // 获取 auth 实例
        const auth = cloudbaseApp.auth();
        await auth.signInAnonymously();
        const loginScope = await auth.loginScope();
        // 如为匿名登录，则输出 true
        console.log("anonymous:", loginScope === "anonymous");
      }
      
        // 获取数据库引用
        const db = cloudbaseApp.database();
        const result = await db.collection("test").get();
        if (result) {
          console.log("查询结果", result.data);
        }else{
          console.log("无内容");
        }
        
        const aabb = await cloudbaseApp.callFunction({
          name: 'quickstartFunctions', // 云函数名称
          data: {
            type:'getOpenId'
          }
        })
        console.log('quickstartFunctions getOpenId:',aabb);
          // data: {
          //   appid: 'wx50b4e76bd470cee4', // 微信公众号或移动应用APPID
      //     subMchId: '1634464709', // 微信支付商户号
      //     apiKey: 'aoruiGhibli1987030612345arrrr110', // 微信支付API密钥
      //     notifyUrl: 'https://your-domain.com/payment/notify', // 支付回调通知地址
      //     apiUrl: 'https://api.mch.weixin.qq.com/v3/pay/transactions/native',
      //     body: '秋招实习汇总表解锁服务', // 商品描述
      //     envId: 'cloud1-1gfyi6az06806a08',
      //     outTradeNo: `PAY${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`, // 商户订单号
      //     spbillCreateIp: '127.0.0.1', // 终端 IP
      //     totalFee: amount // 总金额（单位：分）
      //   },
      // });
      
      // const paymentData = result.result;
      // if (paymentData && paymentData.return_code === 'SUCCESS') {
      //   // 保存订单号，用于后续轮询
      //   const orderData = {
      //     ...paymentData,
      //     out_trade_no: result.data?.outTradeNo || `PAY${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      //   };
      //   setPaymentData(orderData);
      //   console.log('支付二维码生成成功:', paymentData);
      // } else {
      //   throw new Error('云函数返回数据格式错误');
      // }
    } catch (error) {
      console.error('生成支付二维码失败:', error);
      handlePaymentError('生成支付二维码失败，请重试');
    }
  };

  // 开始轮询支付状态
  const startPaymentPolling = () => {
    const pollInterval = setInterval(async () => {
      try {
        if (!paymentData || !paymentData.out_trade_no) {
          return;
        }

        // 调用云函数查询支付状态
        const cloudbaseApp = getApp();
        if (!cloudbaseApp) {
          return; // 如果环境未初始化，跳过轮询
        }
        
        const result = await cloudbaseApp.callFunction({
          name: 'wechat-pay-check-order', // 查询订单状态的云函数
          data: {
            out_trade_no: paymentData.out_trade_no // 商户订单号
          },
        });

        const checkResult = result.result;
        
        if (checkResult && checkResult.trade_state === 'SUCCESS') {
          clearInterval(pollInterval);
          await handlePaymentSuccess();
        } else if (checkResult && checkResult.trade_state === 'CLOSED') {
          clearInterval(pollInterval);
          handlePaymentError('订单已关闭');
        }
      } catch (error) {
        console.error('轮询支付状态失败:', error);
      }
    }, 2000);

    // 清理定时器
    return () => clearInterval(pollInterval);
  };

  // 处理支付成功
  const handlePaymentSuccess = async () => {
    try {
      setPaymentStep('processing');
      
      // 保存支付状态到本地缓存
      await AsyncStorage.setItem('feishu_doc_paid', 'true');
      await AsyncStorage.setItem('payment_time', new Date().toISOString());
      
      setPaymentStep('success');
      
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (error) {
      console.error('处理支付成功失败:', error);
      handlePaymentError('支付成功但状态保存失败');
    }
  };

  // 处理支付错误
  const handlePaymentError = (errorMessage: string) => {
    setPaymentStep('error');
    if (onFailure) {
      onFailure(errorMessage);
    }
    Alert.alert('支付失败', errorMessage);
  };

  // 重新生成二维码
  const regenerateQR = () => {
    generatePaymentQR();
  };

  const getAmountYuan = () => {
    return (amount / 100).toFixed(2);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalContainer}>
        <View style={styles.paymentModal}>
          {/* 头部标题 */}
          <View style={styles.header}>
            <Image source={require('../../assets/images/green-logo.png')} style={styles.wechatLogo} />
            <Text style={styles.title}>微信支付</Text>
          </View>

          {/* 金额显示 */}
          <Text style={styles.amountLabel}>支付金额</Text>
          <Text style={styles.amount}>¥{getAmountYuan()}</Text>
          <Text style={styles.amountSubLabel}>{amount}分</Text>

          {/* 支付内容 */}
          {paymentStep === 'qr' && paymentData && (
            <>
              {/* 二维码区域 */}
              <View style={styles.qrContainer}>
                {paymentData.code_url ? (
                  <QRCode
                    value={paymentData.code_url || `weixin://wxpay/bizpayurl?pr=${paymentData.out_trade_no}`}
                    size={160}
                    color="#000000"
                    backgroundColor="#ffffff"
                  />
                ) : (
                  <View style={styles.qrCodePlaceholder}>
                    <Text style={styles.qrIcon}>📱</Text>
                    <Text style={styles.qrText}>微信支付</Text>
                  </View>
                )}
              </View>

              {/* 支付说明 */}
              <View style={styles.instructionContainer}>
                <Text style={styles.instruction}>请使用微信扫描二维码支付</Text>
                <Text style={styles.orderNo}>订单号: {paymentData.out_trade_no}</Text>
                <Text style={styles.countdownText}>剩余时间: {countdown}秒</Text>
              </View>
            </>
          )}

          {paymentStep === 'processing' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color="#07C160" />
              <Text style={styles.statusText}>支付确认中...</Text>
            </View>
          )}

          {paymentStep === 'success' && (
            <View style={styles.statusContainer}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.statusText}>支付成功！</Text>
            </View>
          )}

          {paymentStep === 'error' && (
            <View style={styles.statusContainer}>
              <Text style={styles.errorIcon}>✗</Text>
              <Text style={styles.statusText}>支付失败</Text>
            </View>
          )}

          {/* 按钮区域 */}
          <View style={styles.buttonContainer}>
            {paymentStep === 'qr' && (
              <>
                <TouchableOpacity style={styles.refreshButton} onPress={regenerateQR}>
                  <Text style={styles.refreshButtonText}>重新生成</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>取消支付</Text>
                </TouchableOpacity>
              </>
            )}

            {paymentStep === 'error' && (
              <>
                <TouchableOpacity style={styles.retryButton} onPress={regenerateQR}>
                  <Text style={styles.retryButtonText}>重新支付</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>返回</Text>
                </TouchableOpacity>
              </>
            )}

            {(paymentStep === 'processing' || paymentStep === 'success') && (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>关闭</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paymentModal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  wechatLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  amount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#07C160',
    textAlign: 'center',
    marginBottom: 4,
  },
  amountSubLabel: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrCodePlaceholder: {
    width: 160,
    height: 160,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  qrText: {
    fontSize: 16,
    color: '#666',
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  orderNo: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  countdownText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '600',
  },
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  statusText: {
    fontSize: 16,
    color: '#333',
    marginTop: 12,
  },
  successIcon: {
    fontSize: 48,
    color: '#07C160',
  },
  errorIcon: {
    fontSize: 48,
    color: '#ff6b6b',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  retryButton: {
    flex: 1,
    backgroundColor: '#07C160',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    flex: 1,
    backgroundColor: '#07C160',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WeChatNativePay;