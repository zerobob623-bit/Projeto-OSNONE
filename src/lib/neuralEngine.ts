import * as tf from '@tensorflow/tfjs';

export type NeuralMood = 'happy' | 'calm' | 'focused' | 'playful' | 'melancholic' | 'angry';

class NeuralEngine {
  private model: tf.LayersModel | null = null;
  private isTraining = false;

  constructor() {
    this.init();
  }

  private async init() {
    // Create a simple sequential model
    const model = tf.sequential();
    
    // Input layer: 4 features (sentiment, intensity, length_normalized, is_question)
    model.add(tf.layers.dense({ units: 8, activation: 'relu', inputShape: [4] }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 6, activation: 'softmax' })); // 6 mood categories

    model.compile({
      optimizer: tf.train.adam(0.01),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.model = model;
    console.log('🧠 Neural Engine Initialized');
    
    // Initial training with some baseline data
    await this.preTrain();
  }

  private async preTrain() {
    if (!this.model) return;

    // [sentiment (-1 to 1), intensity (0 to 1), length (0 to 1), isQuestion (0 or 1)]
    const xs = tf.tensor2d([
      [0.8, 0.5, 0.2, 0], // Happy
      [0.0, 0.2, 0.5, 0], // Calm
      [-0.2, 0.8, 0.1, 0], // Focused/Serious
      [0.5, 0.9, 0.3, 1], // Playful
      [-0.5, 0.3, 0.8, 0], // Melancholic
      [-0.9, 1.0, 0.1, 0], // Angry
    ]);

    const ys = tf.tensor2d([
      [1, 0, 0, 0, 0, 0], // happy
      [0, 1, 0, 0, 0, 0], // calm
      [0, 0, 1, 0, 0, 0], // focused
      [0, 0, 0, 1, 0, 0], // playful
      [0, 0, 0, 0, 1, 0], // melancholic
      [0, 0, 0, 0, 0, 1], // angry
    ]);

    await this.model.fit(xs, ys, { epochs: 50 });
    console.log('🧠 Neural Engine Pre-trained');
  }

  public async predictMood(text: string): Promise<{ mood: NeuralMood; confidence: number }> {
    if (!this.model) return { mood: 'calm', confidence: 0 };

    const features = this.extractFeatures(text);
    const input = tf.tensor2d([features]);
    const prediction = this.model.predict(input) as tf.Tensor;
    const data = await prediction.data();

    const moods: NeuralMood[] = ['happy', 'calm', 'focused', 'playful', 'melancholic', 'angry'];
    let maxIdx = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[maxIdx]) maxIdx = i;
    }

    return {
      mood: moods[maxIdx],
      confidence: data[maxIdx]
    };
  }

  private extractFeatures(text: string): number[] {
    const lower = text.toLowerCase();
    
    // Very simple heuristic-based feature extraction for the local NN
    let sentiment = 0;
    const positive = ['bom', 'ótimo', 'feliz', 'legal', 'amo', 'obrigado', 'sim', 'claro', 'perfeito', 'maravilhoso'];
    const negative = ['ruim', 'triste', 'odeio', 'não', 'péssimo', 'erro', 'problema', 'difícil', 'sozinho', 'vazio'];
    
    positive.forEach(word => { if (lower.includes(word)) sentiment += 0.2; });
    negative.forEach(word => { if (lower.includes(word)) sentiment -= 0.2; });
    sentiment = Math.max(-1, Math.min(1, sentiment));

    const intensity = Math.min(1, (text.match(/[!?]/g)?.length || 0) * 0.2 + (text === text.toUpperCase() ? 0.3 : 0));
    const length = Math.min(1, text.length / 200);
    const isQuestion = text.includes('?') ? 1 : 0;

    return [sentiment, intensity, length, isQuestion];
  }

  // Learn from user feedback or AI correction
  public async learn(text: string, correctMood: NeuralMood) {
    if (!this.model || this.isTraining) return;
    this.isTraining = true;

    const features = this.extractFeatures(text);
    const moods: NeuralMood[] = ['happy', 'calm', 'focused', 'playful', 'melancholic', 'angry'];
    const targetIdx = moods.indexOf(correctMood);
    
    const target = new Array(6).fill(0);
    target[targetIdx] = 1;

    const xs = tf.tensor2d([features]);
    const ys = tf.tensor2d([target]);

    await this.model.fit(xs, ys, { epochs: 5 });
    this.isTraining = false;
    console.log(`🧠 Neural Engine learned: ${correctMood}`);
  }
}

export const neuralBrain = new NeuralEngine();
