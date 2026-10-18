import content from './home-with-testimonials';
import HomeBehavior from './home-behavior';
export default function Home(){return <><div dangerouslySetInnerHTML={{__html:content}}/><HomeBehavior/></>}
