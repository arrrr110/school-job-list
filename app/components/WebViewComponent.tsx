import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PAYMENT_CONFIG } from '../config/payment';
import WeChatNativePay from './WeChatNativePay';

interface WebViewComponentProps {
  url?: string;
  isUnlocked?: boolean;
  onStatusChange?: (unlocked: boolean) => void;
}

const WebViewComponent: React.FC<WebViewComponentProps> = ({ 
  url = "https://yal2at57cvq.feishu.cn/base/GtSLbyyR3aCENOsJYC6cdlsVnih?table=tblH4au5rnBcqHgJ&view=vew8PFC7nG", 
  isUnlocked = false,
  onStatusChange,
}) => {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const originalSrc = "https://yal2at57cvq.feishu.cn/base/GtSLbyyR3aCENOsJYC6cdlsVnih?table=tblH4au5rnBcqHgJ&view=vew8PFC7nG";
  const loginSrc = "https://ai.feishu.cn/wiki/OarwwHBJii4K7KkU4LuczV5onTd";

  useEffect(() => {
    loadPaymentStatus();
  }, []);

  useEffect(() => {
    // 根据解锁状态更新URL
    if (isUnlocked) {
      setIsLoading(true);
      // 模拟解锁后的加载时间，然后更新URL
      setTimeout(() => {
        setCurrentUrl(originalSrc);
        setIsLoading(false);
      }, 1500); // 1.5秒的加载时间
    } else {
      setCurrentUrl(loginSrc);
      setIsLoading(false);
    }
  }, [isUnlocked]);

  const loadPaymentStatus = async () => {
    try {
      const savedPaymentStatus = await AsyncStorage.getItem('feishu_doc_paid');
      
      if (savedPaymentStatus === 'true' && onStatusChange) {
        onStatusChange(true);
      }
    } catch (error) {
      console.error('加载缓存状态失败:', error);
    }
  };

  const handleShowPayment = () => {
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
  };


    return (
    <>
       <View style={styles.container}>
         <iframe
           src={currentUrl}
           style={{
             width: '100%',
             height: '100%',
             border: 'none',
           }}
           allowFullScreen
           title="Feishu Document"
         />
         {isLoading && (
           <View style={styles.loadingOverlay}>
             <View style={styles.loadingContainer}>
               <Text style={styles.loadingSpinner}>🔓</Text>
               <Text style={styles.loadingText}>解锁中...</Text>
               <Text style={styles.loadingSubText}>正在为您加载完整内容</Text>
             </View>
           </View>
         )}
        {!isUnlocked && (
          <View style={styles.lockedIndicator}>
            <View style={styles.textContainer}>
              <Text style={styles.lockedText}>春/秋招+实习汇总表(示例表格)</Text>
              <Text style={styles.lockedText}>付费解锁完整功能</Text>
            </View>
            <TouchableOpacity 
              style={styles.wechatButton} 
              onPress={handleShowPayment}
            >
              <Text style={styles.wechatButtonText}>继续支付 ¥{PAYMENT_CONFIG.AMOUNT_YUAN}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 微信Native支付弹窗 */}
      <WeChatNativePay
        visible={showPaymentModal}
        amount={PAYMENT_CONFIG.AMOUNT} // 使用配置文件中的金额
        onSuccess={() => {
          onStatusChange && onStatusChange(true);
          setShowPaymentModal(false);
          Alert.alert('🎉 支付成功！', '已解锁完整内容');
        }}
        onFailure={(error) => {
          console.error('微信支付失败:', error);
          Alert.alert('支付失败', error);
        }}
        onClose={() => setShowPaymentModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  lockedIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff6b6b',
    padding: 12,
    zIndex: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    flex: 1,
  },
  lockedText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
  },
  wechatButton: {
    backgroundColor: '#07C160',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  wechatButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // 解锁loading样式
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 200,
  },
  loadingSpinner: {
    fontSize: 48,
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  loadingSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default WebViewComponent;