import { Timestamp } from "firebase/firestore";

export type ScriptElementType = 
  | 'scene-heading' 
  | 'action' 
  | 'character' 
  | 'dialogue' 
  | 'parenthetical' 
  | 'transition' 
  | 'note';

export interface ScriptElement {
  id: string;
  type: ScriptElementType;
  text: string;
  color?: string;
  highlight?: string;
  fontWeight?: 'normal' | 'bold';
  fontSize?: 'small' | 'medium' | 'large';
}

export interface ScriptCollaborator {
  userId: string;
  email: string;
  permission: 'view' | 'edit';
}

export interface ScriptSettings {
  fontFamily: 'courier' | 'helvetica' | 'times' | 'roboto' | 'georgia' | 'noto';
  showLabelsInPdf: boolean;
}

export interface Script {
  id: string;
  title: string;
  description?: string;
  writtenBy?: string;
  content: ScriptElement[];
  ownerId: string;
  ownerEmail?: string;
  collaborators: ScriptCollaborator[];
  isPublic: boolean;
  publicPermission: 'view' | 'edit';
  shareId: string;
  settings?: ScriptSettings;
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
}
