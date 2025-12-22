// Minimal Google Maps/Places type shims to satisfy TypeScript without @types/google.maps
// Note: These are intentionally broad (any) to avoid tight coupling
declare namespace google {
	namespace maps {
		const SymbolPath: any

		type LatLng = any
		type Icon = any

		class Map {
			constructor(el: any, opts?: any)
			setCenter(latlng: any): void
			panTo(latlng: any): void
		}

		class Marker {
			constructor(opts?: any)
			setMap(map: Map | null): void
			setPosition(latlng: any): void
			setIcon(icon: Icon | null): void
			addListener(eventName: string, handler: (...args: any[]) => void): { remove(): void }
		}

		class Geocoder {
			geocode(request: any, callback: (...args: any[]) => void): void
		}

		namespace places {
			class Autocomplete {
				constructor(input: any, opts?: any)
				setFields(fields: string[]): void
				addListener(eventName: string, handler: (...args: any[]) => void): { remove(): void }
				getPlace(): any
			}

			class PlacesService {
				constructor(el: any)
				textSearch(request: any, callback: (...args: any[]) => void): void
				getDetails(request: any, callback: (...args: any[]) => void): void
			}

			enum PlacesServiceStatus {
				OK = 'OK',
				ZERO_RESULTS = 'ZERO_RESULTS'
			}

			type PlaceResult = any
			type TextSearchRequest = any
		}
	}
}

declare const google: any

