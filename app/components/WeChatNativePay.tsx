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
import { PAYMENT_CONFIG } from '../config/payment';

interface WeChatNativePayProps {
  visible: boolean;
  amount?: number; // 支付金额（单位：分），可选，默认使用配置文件中的值
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
  amount = PAYMENT_CONFIG.AMOUNT, // 使用配置文件中的默认金额
  onSuccess,
  onFailure,
  onClose,
}) => {
  const [paymentStep, setPaymentStep] = useState<'loading' | 'qr' | 'processing' | 'success' | 'error'>('loading');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(PAYMENT_CONFIG.TIMEOUT); // 使用配置的超时时间
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
      
        // 获取 auth 实例
        const auth = cloudbaseApp.auth();
        await auth.signInAnonymously();
        const loginScope = await auth.loginScope();
        const outTradeNo = `PAY${Date.now()}${Math.floor(Math.random() * 100000)}`
      const result = await cloudbaseApp.callFunction({
        name: 'order', // 云函数名称
        data: {
          totalFee: amount,
          outTradeNo: outTradeNo
        }
      });
      
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
    
    // 使用配置间隔进行轮询，平衡实时性和性能
    pollingRef.current = setInterval(async () => {
      // 如果当前状态已经是成功或错误，停止轮询
      if (paymentStep === 'success' || paymentStep === 'error') {
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
            
            return;
          }

          // 调用云函数查询支付状态
          const cloudbaseApp = getApp();
          if (!cloudbaseApp) {
            return; // 如果环境未初始化，跳过轮询
          }
          
          
          
          const result = await cloudbaseApp.callFunction({
            name: 'query_order', // 查询订单状态的云函数
            data: {
              outTradeNo: tradeNo // 商户订单号
            },
          });

          const checkResult = result.result;
          
          
          // 检查新的返回结构
          if (checkResult && checkResult.success && checkResult.wechatOriginalResponse) {
            const wechatResponse = checkResult.wechatOriginalResponse;
            
            if (wechatResponse.return_code === 'SUCCESS') {
              const tradeState = wechatResponse.trade_state;
              
              
              
              switch (tradeState) {
                case 'SUCCESS':
                  // 支付成功
                  
                  if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                  }
                  await handlePaymentSuccess();
                  
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
                  break;
                case 'NOTPAY':
                  // 未支付，继续轮询
                  break;
                default:
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
    }, PAYMENT_CONFIG.POLLING_INTERVAL);

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
    
    // 设置重试倒计时
    setRetryCountdown(PAYMENT_CONFIG.RETRY_INTERVAL);
  };

  // 重新生成二维码
  const regenerateQR = () => {
    if (retryCountdown > 0) return; // 如果在倒计时中，不允许重试
    generatePaymentQR();
  };

  // 注意：由于使用轮询机制，不再需要单独处理平台支付通知
  // 轮询会定期查询订单状态并更新页面状态

  const getAmountYuan = () => {
    return PAYMENT_CONFIG.AMOUNT_YUAN;
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
                <Text style={styles.instruction}>付费权益绑定当前浏览器</Text>
                <Text style={styles.instruction}>换浏览器或上网设备后需重新付费</Text>
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