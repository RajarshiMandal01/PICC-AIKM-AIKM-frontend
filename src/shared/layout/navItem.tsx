import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { NavItemType } from '../types/nav'
import { IoChevronDown } from "react-icons/io5";
interface Props {
    item: NavItemType,
    selected?:boolean,
    subpath?:string
}

const NavItem: React.FC<Props> = ({ item ,selected,subpath}) => {

    const hasSub = item.submenu && item.submenu?.length > 0
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef<HTMLLIElement | null>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: { target: any; }) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])
    useEffect(()=>{
        console.log(item,selected)
    },[])

    return (
        <li className={`relative ${selected ? 'bg-primary' : 'transparent'} h-full`} ref={wrapperRef}>
            <div
                onClick={() => setOpen((prev) => !prev)}
                className='nnp-menu-item'
            >
                {item.route ? (
                    <Link to={item.route} className="font-medium">{item.label}</Link>
                ) : (
                    <span className="font-medium">{item.label}</span>
                )}
                {hasSub && (
                    <IoChevronDown
                        className={`w-4 h-4 transition-transform ml-2 ${open ? 'rotate-180' : ''}`}
                    />
                )}
            </div>

            {hasSub && open && (
                <ul className="absolute left-0 top-full mt-2 min-w-[200px] bg-white shadow-md rounded border border-border z-50">
                    {item.submenu!.map((sub, i) => (
                        <li key={i}>
                            <Link
                                to={sub.path}
                                onClick={() => setOpen(false)} 
                                className={`block px-4 py-2 text-sm  ${subpath && subpath == sub.route ? 'text-primary' : 'text-muted'}  hover:bg-surface hover:text-primary transition `}
                            >
                                {sub.label}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </li>
    )
}

export default NavItem
