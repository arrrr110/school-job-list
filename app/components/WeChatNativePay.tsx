import cloudbase from '@cloudbase/js-sdk';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
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
  const [paymentStep, setPaymentStep] = useState<'loading' | 'qr' | 'processing' | 'success' | 'error'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [countdown, setCountdown] = useState(60); // 60秒倒计时
  const [retryCountdown, setRetryCountdown] = useState(0); // 重试倒计时
  const pollingRef = useRef<any>(null); // 轮询定时器引用

  useEffect(() => {
    if (visible) {
      generatePaymentQR();
    }
    
    // 组件卸载时清理定时器
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [visible]);

  // 重试倒计时效果
  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

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
      setPaymentStep('loading');
      setCountdown(60);
      
      // 调用云函数实现微信支付统一下单
      const cloudbaseApp = getApp();

      if (!cloudbaseApp) {
        throw new Error('CloudBase环境未初始化');
      }
      
      console.log('CloudBase环境已初始化');
      // 获取 auth 实例
      const auth = cloudbaseApp.auth();
      await auth.signInAnonymously();
      const loginScope = await auth.loginScope();
      // 如为匿名登录，则输出 true
      // console.log("anonymous:", loginScope === "anonymous");
      const outTradeNo = `PAY${Date.now()}${Math.floor(Math.random() * 100000)}`
      // console.log('outTradeNo:', outTradeNo);
      const result = await cloudbaseApp.callFunction({
        name: 'order', // 云函数名称
        data: {
          totalFee: amount,
          outTradeNo: outTradeNo
        }
      });
      
      // console.log('order result:', result);
      
      // 处理云函数返回结果
      if (result && result.result && result.result.success) {
        const paymentData = result.result;
        
        // 保存订单数据，包含 code_url
        const orderData = {
          ...paymentData,
          out_trade_no: outTradeNo,
          code_url: paymentData.code_url || paymentData.wxResponse?.code_url
        };
        
        setPaymentData(orderData);
        setPaymentStep('qr');
        // console.log('支付二维码生成成功:', orderData);
        
        // 开始轮询支付状态，传入订单号
        startPaymentPolling(outTradeNo);
      } else {
        throw new Error(result?.result?.message || '云函数返回数据格式错误');
      }
    } catch (error) {
      console.error('生成支付二维码失败:', error);
      handlePaymentError('生成支付二维码失败，请重试');
    }
  };

  // 开始轮询支付状态
  const startPaymentPolling = (orderNo: string) => {
    // 清理现有的轮询
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    // console.log('开始支付状态轮询，订单号:', orderNo);
    
    // 使用3秒间隔进行轮询，平衡实时性和性能
    pollingRef.current = setInterval(async () => {
      // 如果当前状态已经是成功或错误，停止轮询
      if (paymentStep === 'success' || paymentStep === 'error') {
        // console.log('支付已完成，停止轮询');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        return;
      }
        try {
          // 确定要查询的订单号
          const tradeNo = orderNo;
          
          if (!tradeNo) {
            // console.log('订单号不可用，等待...');
            return;
          }

          // 调用云函数查询支付状态
          const cloudbaseApp = getApp();
          if (!cloudbaseApp) {
            return; // 如果环境未初始化，跳过轮询
          }
          
          // console.log('正在查询订单状态，订单号:', tradeNo);
          
          const result = await cloudbaseApp.callFunction({
            name: 'query_order', // 查询订单状态的云函数
            data: {
              outTradeNo: tradeNo // 商户订单号
            },
          });

          const checkResult = result.result;
          
          // console.log('轮询返回结果:', result);
          // console.log('检查结果数据:', checkResult);
          
          // 检查新的返回结构
          if (checkResult && checkResult.success && checkResult.wechatOriginalResponse) {
            const wechatResponse = checkResult.wechatOriginalResponse;
            
            if (wechatResponse.return_code === 'SUCCESS') {
              const tradeState = wechatResponse.trade_state;
              
              // console.log('当前支付状态:', tradeState);
              
              switch (tradeState) {
                case 'SUCCESS':
                  // 支付成功
                  // console.log('检测到支付成功，正在清理轮询并处理成功状态');
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  await handlePaymentSuccess();
                  // console.log('支付成功处理完成');
                  break;
                case 'CLOSED':
                  // 订单已关闭
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  handlePaymentError('订单已关闭');
                  break;
                case 'REVOKED':
                  // 订单已撤销
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  handlePaymentError('订单已撤销');
                  break;
                case 'PAYERROR':
                  // 支付失败
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  handlePaymentError(`支付失败: ${wechatResponse.trade_state_desc || '未知错误'}`);
                  break;
                case 'USERPAYING':
                  // 用户支付中，继续轮询
                  console.log('用户支付中，继续等待...');
                  break;
                case 'NOTPAY':
                  // 未支付，继续轮询
                  console.log('订单未支付，继续等待...');
                  break;
                default:
                  console.log('未知支付状态:', tradeState);
              }
            } else {
              console.error('查询订单状态失败:', wechatResponse?.return_msg || '未知错误');
            }
          } else {
            console.error('查询订单状态失败:', checkResult?.errMsg || '未知错误');
          }
        } catch (error) {
          console.error('轮询支付状态失败:', error);
        }
    }, 3000);

    // 清理定时器
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  };

  // 处理支付成功
  const handlePaymentSuccess = async () => {
    try {
      console.log('开始处理支付成功');
      setPaymentStep('processing');
      
      // 保存支付状态到本地缓存
      await AsyncStorage.setItem('feishu_doc_paid', 'true');
      await AsyncStorage.setItem('payment_time', new Date().toISOString());
      
      console.log('支付状态已保存，设置成功状态');
      setPaymentStep('success');
      
      setTimeout(() => {
        console.log('执行成功回调');
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
    
    // 设置10秒重试倒计时
    setRetryCountdown(10);
  };

  // 重新生成二维码
  const regenerateQR = () => {
    if (retryCountdown > 0) return; // 如果在倒计时中，不允许重试
    generatePaymentQR();
  };

  // 注意：由于使用轮询机制，不再需要单独处理平台支付通知
  // 轮询会定期查询订单状态并更新页面状态

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

          {/* 支付内容 */}
          {paymentStep === 'loading' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color="#07C160" />
              <Text style={styles.statusText}>正在生成支付二维码...</Text>
            </View>
          )}

          {paymentStep === 'qr' && paymentData && (
            <>
              {/* 二维码区域 */}
              <View style={styles.qrContainer}>
                {paymentData.code_url ? (
                  <QRCode
                    value={paymentData.code_url}
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
              {retryCountdown > 0 && (
                <Text style={styles.retryCountdownText}>请等待 {retryCountdown} 秒后重试</Text>
              )}
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
                <TouchableOpacity 
                  style={[styles.retryButton, retryCountdown > 0 && styles.disabledButton]} 
                  onPress={regenerateQR}
                  disabled={retryCountdown > 0}
                >
                  <Text style={[styles.retryButtonText, retryCountdown > 0 && styles.disabledButtonText]}>
                    {retryCountdown > 0 ? `等待 ${retryCountdown}s` : '重新支付'}
                  </Text>
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
  retryCountdownText: {
    fontSize: 14,
    color: '#ff6b6b',
    fontWeight: '600',
    marginTop: 8,
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
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  disabledButtonText: {
    color: '#666666',
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