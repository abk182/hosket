type Step = {
  id: number;
  coords: Array<number>;
  color: string;
};

type WsMessage = {
  user: string;
  step?: Step;
  text?: String;
};