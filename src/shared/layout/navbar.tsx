import React, { useEffect } from 'react'
import type { NavItemType } from '../types/nav'
import NavItem from './navItem'
import { useLocation } from 'react-router-dom';

const NavBar: React.FC = () => {
    const location = useLocation();
    const segments = location.pathname.split('/').filter(Boolean);
    const menu: NavItemType[] = [
    {
        label: 'Home',
        route: '/dashboard',
    },
    {
        label: 'NEW',
        route: '/module/new',
    },
]
;
    // const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null);

    /* const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    }; */

    // const open = Boolean(anchorEl);
    // const id = open ? 'simple-popover' : undefined;
    useEffect(() => {
        console.log(segments)
    }, [segments])

    return (
        <nav className="nnp-top-header flex items-center justify-between">
            {/* Left side: logo + menu */}
            <div className="w-full flex items-center justify-between h-[inherit]">
                <ul className='flex items-center h-fill-available'></ul>
                <ul className="flex items-center h-fill-available">
                    {menu.map((item, i) => (
                        <NavItem
                            key={i}
                            item={item}
                            selected={item.route == segments[0]}
                            subpath={segments[1]}
                        />
                    ))}
                </ul>
            </div>
        </nav>

    )
}

export default NavBar

