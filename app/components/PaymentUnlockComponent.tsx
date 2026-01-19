import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import WeChatNativePay from './WeChatNativePay';
import { PAYMENT_CONFIG } from '../config/payment';

interface PaymentUnlockComponentProps {
  isVisible: boolean;
  onUnlock: () => void;
  onClose: () => void;
}

const PaymentUnlockComponent: React.FC<PaymentUnlockComponentProps> = ({
  isVisible,
  onUnlock,
  onClose,
}) => {
  const [showNativePay, setShowNativePay] = useState(false);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const savedPaymentStatus = await AsyncStorage.getItem('feishu_doc_paid');
      if (savedPaymentStatus === 'true') {
        // 如果已经付费，自动触发解锁
        setTimeout(() => {
          onUnlock();
          onClose();
        }, 500);
      }
    } catch (error) {
      console.error('检查支付状态失败:', error);
    }
  }, [onUnlock, onClose]);

  useEffect(() => {
    if (isVisible) {
      checkPaymentStatus();
    }
  }, [isVisible, checkPaymentStatus]);


  // 处理Native支付成功
  const handleNativePaySuccess = () => {
    setShowNativePay(false);
    onUnlock();
    onClose();
  };

  // 处理Native支付失败
  const handleNativePayFailure = (error: string) => {
    console.error('Native支付失败:', error);
  };

  // 处理Native支付关闭
  const handleNativePayClose = () => {
    setShowNativePay(false);
  };


  return (
    <View style={styles.container}>
      {/* 半透明背景 - 移除了onPress事件 */}
      <View style={styles.backgroundOverlay} />
      
      {/* 付费组件主体 */}
      <View style={styles.paymentPanel}>
        <View style={styles.headerRow}>
          <View style={styles.leftSection}>
            <Text style={styles.title}>🔒 付费解锁</Text>
            <Text style={styles.description}>付费后查看完整文档</Text>
            <Text style={styles.price}>¥{PAYMENT_CONFIG.AMOUNT_YUAN}</Text>
          </View>
          
          <View style={styles.rightSection}>
            <TouchableOpacity style={styles.infoButton} onPress={onClose}>
              <Text style={styles.infoButtonText}>预览招聘资源企业总表</Text>
              <Text style={styles.infoButtonSubText}>资源长期更新</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 微信Native支付组件 */}
      <WeChatNativePay
        visible={showNativePay}
        amount={PAYMENT_CONFIG.AMOUNT} // 使用配置文件中的金额
        onSuccess={handleNativePaySuccess}
        onFailure={handleNativePayFailure}
        onClose={handleNativePayClose}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: -1000,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  paymentPanel: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 15,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  rightSection: {
    minWidth: 120,
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'red',
    marginTop: 5,
  },
  infoButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  infoButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  infoButtonSubText: {
    color: '#999',
    fontSize: 11,
    textAlign: 'center',
  },
});

export default PaymentUnlockComponent;