export interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCroppedImg(
  imageSrc: string,
  croppedAreaPixels: CroppedArea,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Não foi possível obter contexto do canvas"));
        return;
      }
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Erro ao gerar imagem cortada"));
            return;
          }
          resolve(blob);
        },
        "image/png",
        1,
      );
    };
    image.onerror = () => reject(new Error("Erro ao carregar imagem"));
    image.src = imageSrc;
  });
}
