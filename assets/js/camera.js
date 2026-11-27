export class Camera {
  constructor(video, onStatus = () => {}) {
    this.video = video;
    this.onStatus = onStatus;
    this.stream = null;
    this.settings = null;
    this.audioDevices = [];
    this.audioMode = 'wireless';
    this.deviceId = '';
  }

  audioConstraints(mode = this.audioMode, deviceId = this.deviceId) {
    // USB-C wireless receivers normally deliver an already conditioned digital signal.
    // Start with browser DSP disabled to avoid double AGC/noise suppression.
    const base = mode === 'auto'
      ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : mode === 'noise'
        ? { echoCancellation: false, noiseSuppression: true, autoGainControl: false }
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    return {
      ...base,
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    };
  }

  async listAudioInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.audioDevices = devices.filter(device => device.kind === 'audioinput');
    return this.audioDevices;
  }

  async start({ audioMode = this.audioMode, deviceId = this.deviceId } = {}) {
    if (!window.isSecureContext) {
      throw new Error('Trang web chưa chạy trong HTTPS. Hãy mở bằng địa chỉ https://...github.io');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Chrome không cung cấp quyền truy cập camera. Hãy kiểm tra HTTPS và cập nhật Chrome.');
    }

    this.audioMode = audioMode;
    this.deviceId = deviceId;
    const videoOptions = { facingMode: { ideal: 'user' }, width: { ideal: 1920 }, height: { ideal: 1080 } };
    const audio = this.audioConstraints(audioMode, deviceId);
    const relaxedAudio = { ...audio };
    delete relaxedAudio.sampleRate;
    delete relaxedAudio.channelCount;
    const attempts = [
      { audio, video: videoOptions },
      { audio: relaxedAudio, video: { facingMode: { ideal: 'user' } } },
      ...(!deviceId ? [{ audio: { ...relaxedAudio }, video: true }] : [])
    ];

    let lastError;
    for (const constraints of attempts) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') break;
      }
    }

    if (!this.stream) {
      const name = lastError?.name || 'CameraError';
      const detail = lastError?.message || 'Không xác định được nguyên nhân.';
      throw new Error(`${name}: ${detail}`);
    }

    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    if (this.video.readyState < 1) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Camera đã cấp quyền nhưng không gửi được hình ảnh.')), 10000);
        this.video.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
        this.video.onerror = () => { clearTimeout(timer); reject(new Error('Không đọc được luồng hình ảnh từ camera.')); };
      });
    }
    await this.video.play();

    const videoTrack = this.stream.getVideoTracks()[0];
    const audioTrack = this.stream.getAudioTracks()[0];
    this.settings = {
      ...(videoTrack?.getSettings?.() || {}),
      audio: audioTrack?.getSettings?.() || {},
      audioLabel: audioTrack?.label || 'Microphone',
      audioMode: this.audioMode
    };
    await this.listAudioInputs();
    this.onStatus('connected', this.settings, this.audioDevices);
    return this.stream;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      this.video.srcObject = null;
      this.onStatus('stopped');
    }
  }
}
