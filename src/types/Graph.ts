export interface GraphNode {
    lat: number;
    lon: number;
    name: string;
    modes?: string[];
  }
  
  export interface GraphEdge {
    from: string;
    to: string;
    distance_km?: number;
    connection?: string;
    speed_kmh?: number;
    daily_capacity?: number;
  }
  
  export interface Graph {
    nodes: GraphNode[];
    edges: GraphEdge[];
  }