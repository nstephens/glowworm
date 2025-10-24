import React, { useState, useEffect, useRef } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  formatter?: (value: number) => string;
  className?: string;
  delay?: number;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  formatter = (val) => val.toLocaleString(),
  className,
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Intersection observer to trigger animation when visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      { threshold: 0.1 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  // Animation configuration
  const { number } = useSpring({
    from: { number: 0 },
    to: { number: isVisible ? value : 0 },
    config: { 
      duration: prefersReducedMotion ? 0 : duration,
      tension: 100,
      friction: 50,
    },
    delay: prefersReducedMotion ? 0 : delay,
  });

  return (
    <div ref={counterRef} className={cn("inline-block", className)}>
      {prefix}
      <animated.span className="font-mono tabular-nums">
        {number.to(n => formatter(Math.round(n)))}
      </animated.span>
      {suffix}
    </div>
  );
};

interface CounterCardProps {
  title: string;
  value: number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  formatter?: (value: number) => string;
  className?: string;
}

export const CounterCard: React.FC<CounterCardProps> = ({
  title,
  value,
  icon,
  trend,
  formatter,
  className,
}) => {
  return (
    <div className={cn(
      "p-6 rounded-lg border bg-card text-card-foreground shadow-sm",
      "hover:shadow-md transition-shadow duration-200",
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && (
          <div className="text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-2xl font-bold">
          <AnimatedCounter 
            value={value} 
            formatter={formatter}
            duration={1200}
          />
        </div>
        
        {trend && (
          <div className={cn(
            "flex items-center text-sm",
            trend.isPositive ? "text-green-600" : "text-red-600"
          )}>
            <span className="mr-1">
              {trend.isPositive ? '↗' : '↘'}
            </span>
            <span>
              {Math.abs(trend.value)}% from last period
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
  formatter?: (value: number) => string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  formatter,
  className,
}) => {
  const colorClasses = {
    primary: 'border-primary/20 bg-primary/5',
    secondary: 'border-secondary/20 bg-secondary/5',
    success: 'border-green-200 bg-green-50',
    warning: 'border-yellow-200 bg-yellow-50',
    destructive: 'border-red-200 bg-red-50',
  };

  return (
    <div className={cn(
      "p-6 rounded-lg border shadow-sm transition-all duration-200",
      "hover:shadow-md hover:scale-[1.02]",
      colorClasses[color],
      className
    )}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon && (
          <div className={cn(
            "p-2 rounded-full",
            color === 'primary' && "bg-primary/10 text-primary",
            color === 'secondary' && "bg-secondary/10 text-secondary",
            color === 'success' && "bg-green-100 text-green-600",
            color === 'warning' && "bg-yellow-100 text-yellow-600",
            color === 'destructive' && "bg-red-100 text-red-600",
          )}>
            {icon}
          </div>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-3xl font-bold">
          <AnimatedCounter 
            value={value} 
            formatter={formatter}
            duration={1000}
          />
        </div>
        
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </div>
  );
};
