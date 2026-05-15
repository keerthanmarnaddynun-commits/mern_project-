import { Link } from 'react-router-dom';
import { MapPin, Calendar, Tag, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Item } from '../types';

interface ItemCardProps {
  item: Item;
}

export default function ItemCard({ item }: ItemCardProps) {
  const { user } = useAuth();
  const isLost = item.type === 'lost';
  const isOwner = user ? user._id === item.postedBy : false;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Link
      to={`/item/${item._id}`}
      className={`group rounded-2xl border hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col ${
        isOwner 
          ? 'bg-indigo-50/60 border-indigo-200 border-l-4 border-l-indigo-500 shadow-md shadow-indigo-100/50 hover:border-indigo-300' 
          : 'bg-white border-gray-100 hover:border-blue-200'
      }`}
    >
      <div className="relative h-44 bg-gray-100 overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <Tag className="w-12 h-12 text-gray-300" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
              isLost
                ? 'bg-red-100 text-red-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isLost ? 'Lost' : 'Found'}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 backdrop-blur-sm text-gray-600 border border-gray-200">
            {item.category}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1.5 group-hover:text-blue-600 transition-colors line-clamp-1">
          {item.title}
        </h3>
        <p className="text-gray-500 text-sm leading-relaxed line-clamp-2 mb-3 flex-1">
          {item.description}
        </p>

        <div className="space-y-1.5 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{formatDate(item.date_occurred)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {isOwner && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md shadow-sm">
                Your report
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:gap-2 transition-all">
            View details <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
