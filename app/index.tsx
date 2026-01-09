import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PaymentUnlockComponent from './components/PaymentUnlockComponent';
import WebViewComponent from './components/WebViewComponent';

export default function Index() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPayment, setShowPayment] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    // 应用启动时检查本地缓存的支付状态
    checkInitialPaymentStatus();
  }, []);

  useEffect(() => {
    // 根据解锁状态更新全屏显示
    if (isUnlocked) {
      setIsFullScreen(true);
      setShowPayment(false);
    } else {
      setIsFullScreen(false);
    }
  }, [isUnlocked]);

  const checkInitialPaymentStatus = async () => {
    try {
      console.log('应用启动：检查本地缓存支付状态');
      const savedPaymentStatus = await AsyncStorage.getItem('feishu_doc_paid');
      
      if (savedPaymentStatus === 'true') {
        console.log('检测到已付费状态，自动解锁');
        setIsUnlocked(true);
        setShowPayment(false);
        setIsFullScreen(true);
      } else {
        console.log('检测到未付费状态，显示付费组件');
        setShowPayment(true);
      }
    } catch (error) {
      console.error('检查初始支付状态失败:', error);
    }
  };

  const handleUnlock = () => {
    setIsUnlocked(true);
    setShowPayment(false);
    setIsFullScreen(true);
  };

  const handleClosePayment = () => {
    setShowPayment(false);
  };

  const handleShowPayment = () => {
    setShowPayment(true);
  };

  return (
    <View style={[styles.container, isFullScreen && styles.fullScreenContainer]}>
      {/* 网页显示组件 */}
      <View style={[styles.webviewContainer, isFullScreen && styles.fullScreenWebview]}>
        <WebViewComponent 
          url="https://yal2at57cvq.feishu.cn/base/GtSLbyyR3aCENOsJYC6cdlsVnih?table=tblH4au5rnBcqHgJ&view=vew8PFC7nG"
          isUnlocked={isUnlocked}
          onStatusChange={setIsUnlocked}
        />
      </View>
      
      {/* 付费解锁组件 - 未解锁时显示 */}
      {!isUnlocked && showPayment && (
        <PaymentUnlockComponent
          isVisible={showPayment}
          onUnlock={handleUnlock}
          onClose={handleClosePayment}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  fullScreenContainer: {
    backgroundColor: '#000',
  },
  webviewContainer: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    margin: 10,
  },
  fullScreenWebview: {
    borderWidth: 0,
    borderRadius: 0,
    margin: 0,
    flex: 1,
  },
});