export type EventWithVenue = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  displayTime: string;
  venue: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
  };
  goingCount: number;
  myGoing: boolean;
  mySaved: boolean;
};
