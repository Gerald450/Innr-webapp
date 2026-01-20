"use client";

import { useState, useEffect, useCallback } from "react";

export type AddressSuggestion = {
  display_name: string;
  lat: string;
  lon: string;
};

type NominatimResponse = {
  display_name: string;
  lat: string;
  lon: string;
};

const DEBOUNCE_DELAY = 400; // ms
const MIN_QUERY_LENGTH = 3; // Minimum characters before searching

export function useAddressAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear suggestions if query is too short
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Debounce the API call
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Respect Nominatim's usage policy: max 1 request per second
        // Include User-Agent header as required
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          {
            headers: {
              "User-Agent": "Innr Campus Social Network App", // Required by Nominatim
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: NominatimResponse[] = await response.json();
        
        // Transform the response to our AddressSuggestion type
        const formattedSuggestions: AddressSuggestion[] = data.map((item) => ({
          display_name: item.display_name,
          lat: item.lat,
          lon: item.lon,
        }));

        setSuggestions(formattedSuggestions);
      } catch (err) {
        console.error("Error fetching address suggestions:", err);
        setError("Failed to fetch address suggestions");
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY);

    // Cleanup function to cancel the timeout if query changes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [query]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    clearSuggestions,
  };
}

