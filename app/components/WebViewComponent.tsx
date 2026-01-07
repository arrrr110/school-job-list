import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 条件导入 WebView
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    const WebViewModule = require('react-native-webview');
    WebView = WebViewModule.WebView;
  } catch (error) {
    console.warn('WebView not available:', error);
  }
}

interface WebViewComponentProps {
  url?: string;
  isUnlocked?: boolean;
  onStatusChange?: (unlocked: boolean) => void;
}

const WebViewComponent: React.FC<WebViewComponentProps> = ({ 
  url = "https://yal2at57cvq.feishu.cn/base/GtSLbyyR3aCENOsJYC6cdlsVnih?table=tblH4au5rnBcqHgJ&view=vew8PFC7nG", 
  isUnlocked = false,
  onStatusChange
}) => {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [loading, setLoading] = useState(true);
  
  const originalSrc = "https://yal2at57cvq.feishu.cn/base/GtSLbyyR3aCENOsJYC6cdlsVnih?table=tblH4au5rnBcqHgJ&view=vew8PFC7nG";
  const loginSrc = "https://ai.feishu.cn/wiki/OarwwHBJii4K7KkU4LuczV5onTd";

  useEffect(() => {
    loadPaymentStatus();
  }, []);

  useEffect(() => {
    // 根据解锁状态更新URL
    if (isUnlocked) {
      setCurrentUrl(originalSrc);
    } else {
      setCurrentUrl(loginSrc);
    }
  }, [isUnlocked]);

  const loadPaymentStatus = async () => {
    try {
      const savedPaymentStatus = await AsyncStorage.getItem('feishu_doc_paid');
      console.log('加载本地缓存状态:', savedPaymentStatus);
      
      if (savedPaymentStatus === 'true' && onStatusChange) {
        onStatusChange(true);
      }
    } catch (error) {
      console.error('加载缓存状态失败:', error);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'payment_success') {
        onStatusChange && onStatusChange(true);
      }
    } catch (error) {
      console.log('消息解析失败:', error);
    }
  };

  // Web平台的替代渲染
  if (Platform.OS === 'web') {
    return (
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
        {!isUnlocked && (
          <View style={styles.lockedOverlay} />
        )}
      </View>
    );
  }

  // React Native平台的WebView
  if (WebView) {
    if (!isUnlocked) {
      return (
        <View style={styles.container}>
          <WebView
            source={{ uri: currentUrl }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            onMessage={handleMessage}
            onLoadEnd={() => setLoading(false)}
          />
          <View style={styles.lockedOverlay} />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <WebView
          source={{ uri: currentUrl }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          allowsBackForwardNavigationGestures={true}
          onMessage={handleMessage}
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        )}
      </View>
    );
  }

  // WebView不可用时的fallback
  return (
    <View style={styles.container}>
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ WebView组件不支持当前平台</Text>
        <Text style={styles.urlText}>文档链接: {currentUrl}</Text>
        <Text style={styles.instructionText}>
          {isUnlocked ? '已解锁' : '未解锁 - 请访问浏览器查看'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 2,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 15,
  },
  urlText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});

export default WebViewComponent;