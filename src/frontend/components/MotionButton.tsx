'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';

type CommonProps = {
  children: React.ReactNode;
  className?: string;
};

type AnchorProps = CommonProps & Omit<HTMLMotionProps<'a'>, 'children' | 'className'> & { href: string };
type ButtonProps = CommonProps & Omit<HTMLMotionProps<'button'>, 'children' | 'className'> & { href?: undefined };

export default function MotionButton(props: AnchorProps | ButtonProps) {
  const { children, className, ...rest } = props;
  const shared = {
    whileHover: { scale: 1.045, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } },
    whileTap: { scale: 0.96 },
  };

  if ('href' in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as Omit<AnchorProps, 'children' | 'className'>;
    return (
      <motion.a href={href} className={className} {...shared} {...anchorRest}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button className={className} {...shared} {...(rest as Omit<ButtonProps, 'children' | 'className' | 'href'>)}>
      {children}
    </motion.button>
  );
}
