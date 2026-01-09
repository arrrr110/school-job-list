import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

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
  const [showQRCode, setShowQRCode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'paid' | 'unpaid'>('unpaid');

  useEffect(() => {
    if (isVisible) {
      checkPaymentStatus();
    }
  }, [isVisible]);

  const checkPaymentStatus = async () => {
    try {
      const savedPaymentStatus = await AsyncStorage.getItem('feishu_doc_paid');
      if (savedPaymentStatus === 'true') {
        setCurrentStatus('paid');
        // 如果已经付费，自动触发解锁
        setTimeout(() => {
          onUnlock();
          onClose();
        }, 500);
      } else {
        setCurrentStatus('unpaid');
      }
    } catch (error) {
      console.error('检查支付状态失败:', error);
    }
  };

  const handleWeChatPay = async () => {
    setShowQRCode(true);
    
    // 模拟支付流程
    setTimeout(async () => {
      setIsProcessing(true);
      
      // 模拟支付完成
      setTimeout(async () => {
        try {
          // 保存支付状态到本地缓存
          await AsyncStorage.setItem('feishu_doc_paid', 'true');
          
          setIsProcessing(false);
          setShowQRCode(false);
          setCurrentStatus('paid');
          
          Alert.alert('🎉 付费成功！', '已解锁完整内容', [
            {
              text: '确定',
              onPress: () => {
                onUnlock();
                onClose();
              },
            },
          ]);
        } catch (error) {
          console.error('保存支付状态失败:', error);
          Alert.alert('错误', '支付状态保存失败，请重试');
        }
      }, 3000);
    }, 1000);
  };

  const handleRealWeChatPay = () => {
    const wechatPayUrl = 'wxpay://pay?amount=9.99&desc=飞书云文档访问权限';
    
    Linking.canOpenURL(wechatPayUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(wechatPayUrl);
        } else {
          // 如果打不开微信支付，显示二维码
          handleWeChatPay();
        }
      })
      .catch((err) => {
        console.error('打开微信支付失败:', err);
        handleWeChatPay();
      });
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
            <Text style={styles.price}>¥9.99</Text>
          </View>
          
          <View style={styles.rightSection}>
            <TouchableOpacity 
              style={[
                styles.wechatButton,
                currentStatus === 'paid' && styles.wechatButtonDisabled
              ]} 
              onPress={handleRealWeChatPay}
              disabled={isProcessing || currentStatus === 'paid'}
            >
              <Text style={[
                styles.wechatButtonText,
                currentStatus === 'paid' && styles.wechatButtonTextDisabled
              ]}>
                {currentStatus === 'paid' ? '✅ 已付费' : 
                 isProcessing ? '处理中...' : '💳 微信支付 ¥9.99'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>关闭,先了解一下示例表格再做决定</Text>
        </TouchableOpacity>
          </View>
        </View>
        

      </View>

      {/* 支付二维码模态框 */}
      <Modal visible={showQRCode} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.qrCodeContainer}>
            <Text style={styles.qrCodeTitle}>微信支付</Text>
            <View style={styles.qrCodePlaceholder}>
              <Text style={styles.qrCodeText}>📱</Text>
              <Text style={styles.qrCodeLabel}>请使用微信扫码支付</Text>
            </View>
            <Text style={styles.qrCodeAmount}>¥9.9</Text>
            <TouchableOpacity 
              style={styles.cancelPayButton} 
              onPress={() => setShowQRCode(false)}
            >
              <Text style={styles.cancelPayText}>取消支付</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  wechatButton: {
    backgroundColor: '#07C160',
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 15,
    minWidth: 200,
    alignItems: 'center',
  },
  wechatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  wechatButtonDisabled: {
    backgroundColor: '#ddd',
  },
  wechatButtonTextDisabled: {
    color: '#999',
  },
  statusText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    paddingHorizontal: 8,
  },
  qrCodeContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 30,
    alignItems: 'center',
    minWidth: 280,
  },
  qrCodeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  qrCodePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  qrCodeText: {
    fontSize: 40,
    marginBottom: 10,
  },
  qrCodeLabel: {
    fontSize: 14,
    color: '#666',
  },
  qrCodeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  cancelPayButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
  },
  cancelPayText: {
    color: '#666',
    fontSize: 14,
  },
});

export default PaymentUnlockComponent;