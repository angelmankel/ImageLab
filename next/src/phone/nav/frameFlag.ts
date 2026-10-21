/** Whether the phone's nav frame (stacked cards + HUD band) is on: old full-screen pieces (the lone Back pill) step aside. */
import { create } from 'zustand';
export const useNavFrame = create<{ on: boolean }>(() => ({ on: false }));
