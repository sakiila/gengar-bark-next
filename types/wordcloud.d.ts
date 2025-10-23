declare module 'wordcloud' {
  interface WordCloudOptions {
    list: [string, number][];
    gridSize?: number;
    weightFactor?: number | ((size: number) => number);
    fontFamily?: string;
    fontWeight?: string | number;
    color?: string | ((word: string, weight: number) => string);
    minSize?: number;
    backgroundColor?: string;
    rotateRatio?: number;
    rotation?: number;
    shape?: string | ((theta: number) => (x: number, y: number) => boolean);
    ellipticity?: number;
    clearCanvas?: boolean;
    wait?: number;
    shuffle?: boolean;
    drawOutOfBound?: boolean;
    shrinkToFit?: boolean;
    hover?: (item: [string, number] | undefined, dimension: [number, number, number, number] | undefined, event: MouseEvent) => void;
    click?: (item: [string, number], dimension: [number, number, number, number], event: MouseEvent) => void;
    classes?: string | ((word: string, weight: number) => string);
  }

  function wordcloud(
    elements: HTMLElement | HTMLElement[] | HTMLCanvasElement,
    options: WordCloudOptions
  ): void;

  export = wordcloud;
}
