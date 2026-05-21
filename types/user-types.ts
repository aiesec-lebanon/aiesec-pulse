export interface Role {
  id: string;
  name: string;
}

export interface Office {
  id: string;
  name: string;
  tag: string;
}

export interface Position {
  id: string;
  office: Office;
  role: Role;
}

export default interface UserInfo {
  full_name: string;
  profile_photo: string;
  current_positions: Position[];
  activePositionId?: string;
}
