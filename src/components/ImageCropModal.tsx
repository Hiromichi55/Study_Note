import React, { useEffect, useRef, useState } from 'react';
import { View, Image, Modal, StyleSheet, Text, TouchableOpacity, PanResponder, PanResponderInstance, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

type CropBox = { x: number; y: number; width: number; height: number };
type HandleType = 'move' | 'tl' | 'tr' | 'bl' | 'br';
export type ImageCropRect = { originX: number; originY: number; width: number; height: number };

const MIN_CROP_SIZE = 40;
const HANDLE_SIZE = 28;

type Props = {
  visible: boolean;
  imageUri: string | null;
  imageWidth: number;
  imageHeight: number;
  /** 再トリミング時に、前回の切り取り範囲(元画像のピクセル座標)を初期表示するための値 */
  initialCropRect?: ImageCropRect | null;
  onCancel: () => void;
  onConfirm: (result: { uri: string; width: number; height: number; cropRect: ImageCropRect }) => void;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ImageCropModal: React.FC<Props> = ({ visible, imageUri, imageWidth, imageHeight, initialCropRect, onCancel, onConfirm }) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const stageMaxWidth = screenWidth - 48;
  const stageMaxHeight = screenHeight * 0.55;

  const safeAspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  let displayWidth = stageMaxWidth;
  let displayHeight = displayWidth / safeAspect;
  if (displayHeight > stageMaxHeight) {
    displayHeight = stageMaxHeight;
    displayWidth = displayHeight * safeAspect;
  }

  const computeInitialCropBox = (): CropBox => {
    if (initialCropRect && imageWidth > 0 && imageHeight > 0) {
      const scaleX = displayWidth / imageWidth;
      const scaleY = displayHeight / imageHeight;
      const width = clamp(initialCropRect.width * scaleX, MIN_CROP_SIZE, displayWidth);
      const height = clamp(initialCropRect.height * scaleY, MIN_CROP_SIZE, displayHeight);
      const x = clamp(initialCropRect.originX * scaleX, 0, displayWidth - width);
      const y = clamp(initialCropRect.originY * scaleY, 0, displayHeight - height);
      return { x, y, width, height };
    }
    return { x: 0, y: 0, width: displayWidth, height: displayHeight };
  };

  const [cropBox, setCropBox] = useState<CropBox>(computeInitialCropBox());
  const [isProcessing, setIsProcessing] = useState(false);
  const cropBoxRef = useRef<CropBox>(cropBox);
  const dragStartRef = useRef<CropBox>(cropBox);
  // PanResponder はマウント時に一度だけ生成するため、表示サイズは ref 経由で常に最新値を読む
  const boundsRef = useRef({ displayWidth, displayHeight });

  useEffect(() => {
    cropBoxRef.current = cropBox;
  }, [cropBox]);

  useEffect(() => {
    boundsRef.current = { displayWidth, displayHeight };
  }, [displayWidth, displayHeight]);

  useEffect(() => {
    if (visible) {
      setCropBox(computeInitialCropBox());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, imageUri]);

  const applyDrag = (type: HandleType, dx: number, dy: number) => {
    const start = dragStartRef.current;
    const { displayWidth: boundsWidth, displayHeight: boundsHeight } = boundsRef.current;
    if (type === 'move') {
      const x = clamp(start.x + dx, 0, Math.max(0, boundsWidth - start.width));
      const y = clamp(start.y + dy, 0, Math.max(0, boundsHeight - start.height));
      setCropBox({ ...start, x, y });
      return;
    }
    let { x, y, width, height } = start;
    if (type === 'tl' || type === 'bl') {
      const newX = clamp(start.x + dx, 0, start.x + start.width - MIN_CROP_SIZE);
      width = start.width + (start.x - newX);
      x = newX;
    }
    if (type === 'tr' || type === 'br') {
      const newRight = clamp(start.x + start.width + dx, start.x + MIN_CROP_SIZE, boundsWidth);
      width = newRight - start.x;
    }
    if (type === 'tl' || type === 'tr') {
      const newY = clamp(start.y + dy, 0, start.y + start.height - MIN_CROP_SIZE);
      height = start.height + (start.y - newY);
      y = newY;
    }
    if (type === 'bl' || type === 'br') {
      const newBottom = clamp(start.y + start.height + dy, start.y + MIN_CROP_SIZE, boundsHeight);
      height = newBottom - start.y;
    }
    setCropBox({ x, y, width, height });
  };

  const makeResponder = (type: HandleType): PanResponderInstance =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartRef.current = cropBoxRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        applyDrag(type, gestureState.dx, gestureState.dy);
      },
    });

  const moveResponder = useRef(makeResponder('move')).current;
  const tlResponder = useRef(makeResponder('tl')).current;
  const trResponder = useRef(makeResponder('tr')).current;
  const blResponder = useRef(makeResponder('bl')).current;
  const brResponder = useRef(makeResponder('br')).current;

  const handleConfirm = async () => {
    if (!imageUri || displayWidth <= 0 || displayHeight <= 0) return;
    setIsProcessing(true);
    try {
      const scaleX = imageWidth / displayWidth;
      const scaleY = imageHeight / displayHeight;
      const originX = Math.round(cropBox.x * scaleX);
      const originY = Math.round(cropBox.y * scaleY);
      const cropWidth = Math.round(cropBox.width * scaleX);
      const cropHeight = Math.round(cropBox.height * scaleY);
      const result = await manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
        { compress: 1, format: SaveFormat.JPEG }
      );
      onConfirm({
        uri: result.uri,
        width: result.width,
        height: result.height,
        cropRect: { originX, originY, width: cropWidth, height: cropHeight },
      });
    } catch (e) {
      console.error('画像のトリミングに失敗:', e);
      Alert.alert('エラー', '画像のトリミングに失敗しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible || !imageUri) return null;

  const strips = [
    { left: 0, top: 0, width: displayWidth, height: cropBox.y },
    { left: 0, top: cropBox.y + cropBox.height, width: displayWidth, height: Math.max(0, displayHeight - (cropBox.y + cropBox.height)) },
    { left: 0, top: cropBox.y, width: cropBox.x, height: cropBox.height },
    { left: cropBox.x + cropBox.width, top: cropBox.y, width: Math.max(0, displayWidth - (cropBox.x + cropBox.width)), height: cropBox.height },
  ];

  const handlePositions: Array<{ type: HandleType; left: number; top: number; responder: PanResponderInstance }> = [
    { type: 'tl', left: cropBox.x - HANDLE_SIZE / 2, top: cropBox.y - HANDLE_SIZE / 2, responder: tlResponder },
    { type: 'tr', left: cropBox.x + cropBox.width - HANDLE_SIZE / 2, top: cropBox.y - HANDLE_SIZE / 2, responder: trResponder },
    { type: 'bl', left: cropBox.x - HANDLE_SIZE / 2, top: cropBox.y + cropBox.height - HANDLE_SIZE / 2, responder: blResponder },
    { type: 'br', left: cropBox.x + cropBox.width - HANDLE_SIZE / 2, top: cropBox.y + cropBox.height - HANDLE_SIZE / 2, responder: brResponder },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Text style={styles.title}>トリミング</Text>
        <Text style={styles.subtitle}>四隅をドラッグして範囲を調整できます</Text>
        <View style={{ width: displayWidth, height: displayHeight }}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: displayWidth, height: displayHeight }}
            resizeMode="contain"
          />
          {strips.map((s, i) => (
            <View key={i} pointerEvents="none" style={[styles.strip, s]} />
          ))}
          <View
            style={[styles.cropBox, { left: cropBox.x, top: cropBox.y, width: cropBox.width, height: cropBox.height }]}
            {...moveResponder.panHandlers}
          />
          {handlePositions.map(({ type, left, top, responder }) => (
            <View
              key={type}
              style={[styles.handle, { left, top }]}
              {...responder.panHandlers}
            >
              <View style={styles.handleDot} />
            </View>
          ))}
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel} disabled={isProcessing}>
            <Text style={styles.cancelButtonText}>キャンセル</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirm} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>決定</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginBottom: 16,
  },
  strip: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  confirmButton: {
    backgroundColor: '#8A6F56',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ImageCropModal;
