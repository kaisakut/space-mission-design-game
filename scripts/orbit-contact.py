import math
MU=398600.4418; RE=6378.137; J2=1.08263e-3; WE=7.2921159e-5
def sso_inc(h):
    a=RE+h; n=math.sqrt(MU/a**3)
    need=2*math.pi/(365.2422*86400)
    cosi=-need/(1.5*n*J2*(RE/a)**2)
    return math.degrees(math.acos(cosi))
def contact(h,inc,lat=35.0,lon=0.0,mask=10,days=10,dt=10):
    a=RE+h; n=math.sqrt(MU/a**3); i=math.radians(inc)
    raan_dot=-1.5*n*J2*(RE/a)**2*math.cos(i)
    la=math.radians(lat); lo=math.radians(lon)
    g=[RE*math.cos(la)*math.cos(lo),RE*math.cos(la)*math.sin(lo),RE*math.sin(la)]
    up=[x/RE for x in g]; vis=0; t=0
    while t<days*86400:
        u=n*t; O=raan_dot*t
        x=a*(math.cos(O)*math.cos(u)-math.sin(O)*math.sin(u)*math.cos(i))
        y=a*(math.sin(O)*math.cos(u)+math.cos(O)*math.sin(u)*math.cos(i))
        z=a*math.sin(u)*math.sin(i)
        th=WE*t; xe=math.cos(th)*x+math.sin(th)*y; ye=-math.sin(th)*x+math.cos(th)*y
        d=[xe-g[0],ye-g[1],z-g[2]]; r=math.sqrt(sum(c*c for c in d))
        el=math.degrees(math.asin(sum(d[k]*up[k] for k in range(3))/r))
        if el>=mask: vis+=dt
        t+=dt
    return vis/60/days
for h,inc in [(410,51.6),(500,None),(600,None)]:
    ii=inc or sso_inc(h)
    print(h, round(ii,2), [round(contact(h,ii,lat=L),1) for L in (35,65)])
