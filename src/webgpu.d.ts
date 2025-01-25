interface Navigator {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>;
    // Add other WebGPU properties as needed
  };
}
