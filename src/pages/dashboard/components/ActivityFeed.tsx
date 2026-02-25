
import React from 'react';
import { RecentActivity } from '../hooks/useRecentActivity';

interface Props {
  activities: RecentActivity[];
  loading: boolean;
}

/**
 * ActivityFeed component displays a list of recent activities.
 * It handles loading state, empty state, and unexpected data gracefully.
 */
export default function ActivityFeed({ activities = [], loading }: Props) {
  // Guard against unexpected null/undefined values
  const safeActivities = Array.isArray(activities) ? activities : [];

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Actividad Reciente
        </h3>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start space-x-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-3 w-3/4 bg-gray-200 rounded mb-1"></div>
                <div className="h-2 w-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Actividad Reciente
        </h3>
        <div className="flex items-center space-x-1.5">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[11px] text-gray-400">En vivo</span>
        </div>
      </div>

      {safeActivities.length === 0 ? (
        <div className="text-center py-8">
          <i className="ri-time-line text-3xl text-gray-300 mb-2"></i>
          <p className="text-sm text-gray-400">Sin actividad reciente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {safeActivities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div
                className={`w-8 h-8 min-w-[32px] rounded-lg flex items-center justify-center ${activity.color}`}
              >
                <i className={`${activity.icon} text-sm`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-snug truncate">
                  {activity.description}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {activity.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
