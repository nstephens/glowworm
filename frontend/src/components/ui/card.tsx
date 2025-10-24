import * as React from "react"
import { motion, type MotionProps } from "framer-motion"

import { cn } from "../../lib/utils"
import { useReducedMotion } from "@/hooks/useReducedMotion"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add hover effect */
  hoverable?: boolean;
  /** Add click animation */
  interactive?: boolean;
  /** Enable animations */
  animated?: boolean;
  /** Custom motion props */
  motionProps?: MotionProps;
  /** Click handler */
  onClick?: () => void;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, interactive = false, animated = true, motionProps, onClick, ...props }, ref) => {
    const prefersReducedMotion = useReducedMotion()
    
    const animationProps = animated && !prefersReducedMotion && (hoverable || interactive) ? {
      whileHover: hoverable ? { 
        y: -4, 
        boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        transition: { duration: 0.2, ease: "easeOut" }
      } : undefined,
      whileTap: interactive ? { 
        scale: 0.98,
        transition: { duration: 0.1 }
      } : undefined,
      ...motionProps,
    } : {}

    const MotionComponent = animated && !prefersReducedMotion && (hoverable || interactive) ? motion.div : "div"

    return (
      <MotionComponent
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200",
          hoverable && "hover:shadow-md hover:border-primary/20",
          interactive && "cursor-pointer",
          className
        )}
        onClick={onClick}
        {...animationProps}
        {...props}
      />
    )
  }
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-2 p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
