import { useMediaQuery } from '@mantine/hooks';

/** One breakpoint for the whole app: under 768px CSS wide = the phone shell (dock, swipe, sheets). */
export const PHONE_QUERY = '(max-width: 767px)';
export function useIsPhone(): boolean {
  return useMediaQuery(PHONE_QUERY, typeof window !== 'undefined' ? window.matchMedia(PHONE_QUERY).matches : false) ?? false;
}
