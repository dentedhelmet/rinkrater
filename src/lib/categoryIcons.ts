export const CATEGORY_ICON_MAP: Record<string, string> = {
  'CONCESSIONS':                    '/category-icons/rr-concessions_icon.png',
  'DRINKS':                         '/category-icons/rr-concessions_icon.png',
  'FACILITY OVERVIEW':              '/category-icons/rr-facility_icon.png',
  'FIRST IMPRESSIONS':              '/category-icons/rr-facility_icon.png',
  'GIRLS LOCKER ROOM':              '/category-icons/rr-lockerrooms_icon.png',
  'HOME TEAM INSIGHTS':             '/category-icons/rr-hometeaminsights_icon.png',
  'ICE CONDITIONS':                 '/category-icons/rr-ice_icon.png',
  'LIVE STREAMING':                 '/category-icons/rr-livestream_icon.png',
  'LOCKER ROOMS':                   '/category-icons/rr-lockerrooms_icon.png',
  'PARKING':                        '/category-icons/rr-parking_icon.png',
  'PRO SHOP':                       '/category-icons/rr-proshop_icon.png',
  "REF'S CREASE":                   '/category-icons/rr-refsroom_icon.png',
  "REF'S ROOM":                     '/category-icons/rr-refsroom_icon.png',
  'RESTROOMS':                      '/category-icons/rr-bathrooms_icon.png',
  'RINK RAT ACTIVITIES':            '/category-icons/rr-rinkrat_icon.png',
  'RINK TEMPERATURE':               '/category-icons/rr_temp_icon.png',
  'ROLLER HOCKEY':                  '/category-icons/rr-roller_icon.png',
  'SEATING / BEST VIEWING SPOTS':   '/category-icons/rr-seating_icon.png',
  'SEATING AREA / WARMING AREA':    '/category-icons/rr-seating_icon.png',
  'SKATE SHARPENING':               '/category-icons/rr-skatesharpening_icon.png',
  'SLED HOCKEY':                    '/category-icons/rr-sledhockey_icon.png',
  'VIEW OBSTRUCTIONS':              '/category-icons/rr-viewobstruction_icon.png',
  'WARM UP AREAS':                  '/category-icons/rr-seating_icon.png',
  "WI-FI":                          '/category-icons/rr-wifi_icon.png',
  'ADA ACCESSIBILITY':              '/category-icons/rr-ada_icon.png',
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICON_MAP[category] || '/category-icons/rr-facility_icon.png'
}
