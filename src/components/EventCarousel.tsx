import React, { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import axios from "axios";
import { Megaphone, Trophy, Star, Zap, Loader2 } from "lucide-react";

const API_URL = "/api";

interface Event {
  id: string;
  title: string;
  description: string;
  icon: string;
  link?: string;
  color?: string;
}

export const EventCarousel = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [emblaRef] = useEmblaCarousel({ 
    loop: true,
    duration: 60,
  }, [
    Autoplay({ 
      delay: 8000,
      stopOnInteraction: false,
      stopOnMouseEnter: true
    })
  ]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get(`${API_URL}/events`);
        setEvents(res.data);
      } catch (err) {
        console.error("Error fetching events for carousel:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="relative mb-10 h-16 flex items-center justify-center bg-card/30 rounded-xl border border-border/40">
        <Loader2 className="h-4 w-4 animate-spin text-primary/40" />
      </div>
    );
  }

  if (events.length === 0) return null;
  
  return (
    <div className="relative mb-10 group">
      {/* Background Glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/15 via-accent/15 to-primary/15 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-700"></div>
      
      <div className="relative overflow-hidden rounded-xl bg-card/30 backdrop-blur-sm border border-border/40 shadow-xl" ref={emblaRef}>
        <div className="flex">
          {events.map((event) => (
            <div 
              key={event.id} 
              className="flex-[0_0_100%] min-w-0 flex items-center justify-center py-3 px-4 md:py-4 cursor-pointer"
              onClick={() => event.link && window.open(event.link, '_blank')}
            >
              <div className="flex items-center gap-4 text-left">
                <div className={`p-2 rounded-lg border bg-primary/10 border-primary/20 shadow-md flex items-center justify-center text-xl`}>
                  {event.icon}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80 leading-none mb-1">
                    Evento Ativo
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground leading-tight">
                      {event.title}
                    </span>
                    <p className="text-xs md:text-sm text-muted-foreground leading-relaxed mt-0.5">
                      {event.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation dots indicator */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
        {events.map((_, i) => (
          <div key={i} className="h-1 w-3 rounded-full bg-border/20" />
        ))}
      </div>
    </div>
  );
};
